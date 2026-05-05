import {
  HumanMessage,
  type BaseMessage,
  type MessageContent,
} from "@langchain/core/messages";
import { tool, type ToolRuntime } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { Inject, Injectable } from "@nestjs/common";
import { createAgent } from "langchain";
import { z } from "zod";

import { throwIfAborted } from "../../Domain/agentAbort.js";
import type {
  AgentExecutionPlan,
  AgentExecutionContext,
  AgentImageInput,
  AgentTraceHooks,
  AgentTraceStep,
} from "../../Domain/agentTypes.js";
import type {
  AgentSkillCategory,
  AgentSkillDefinition,
} from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import {
  resolveFixedChainSteps,
  usesFixedSpecialistChain,
  type FixedChainStep,
} from "../MultiAgent/agentMultiAgentChains.js";
import {
  buildChainSynthesisSystemPrompt,
  buildSpecialistSystemPrompt,
  buildSupervisorSystemPrompt,
  formatChainResults,
  getSpecialistMetadata,
} from "../MultiAgent/agentMultiAgentPrompts.js";
import { AgentModelFactory } from "./agentModelFactory.js";

// supervisor 在 dynamic-supervisor 模式下调用 specialist tool 时，必须传入这份任务描述。
// task 是真正要 specialist 完成的子任务；expectedOutput 是可选的输出约束。
const specialistTaskSchema = z.object({
  expectedOutput: z.string().trim().min(1).max(500).optional(),
  task: z.string().trim().min(1).max(4000),
});

// LangChain createAgent 返回的对象类型较复杂，这里提取 stream 入参/返回值，统一包装成项目自己的 AgentGraph。
type BaseAgentGraph = ReturnType<typeof createAgent>;
type AgentStreamInput = Parameters<BaseAgentGraph["stream"]>[0];
type AgentStreamOptions = Parameters<BaseAgentGraph["stream"]>[1];
type AgentStreamResult = ReturnType<BaseAgentGraph["stream"]>;

// AgentService 只需要知道“这个 graph 可以 stream”，不用关心底层是 createAgent 还是自定义 pipeline。
type AgentGraph = {
  stream: (input: AgentStreamInput, options?: AgentStreamOptions) => AgentStreamResult;
};

// createGraph 的返回值：graph 负责真实执行，executionPlan 负责前端 trace 面板先展示计划。
type AgentGraphBundle = {
  executionPlan: AgentExecutionPlan;
  graph: AgentGraph;
};

// 多个 skill 可能属于同一个 category，例如 code-engineering 和 runtime-verification 都属于 engineering。
type SpecialistGroup = {
  category: AgentSkillCategory;
  skills: AgentSkillDefinition[];
};

// SpecialistRuntime 是“可执行专家”：一组同 category skills + 独立 agent + 展示/路由 metadata。
type SpecialistRuntime = SpecialistGroup & {
  agent: BaseAgentGraph;
  metadata: ReturnType<typeof getSpecialistMetadata>;
  modelName: string;
};

// specialist 执行后只向 supervisor 返回简洁文本结果，不直接向用户流式输出。
type SpecialistRunResult = {
  category: AgentSkillCategory;
  output: string;
};

const groupSkillsByCategory = (skills: readonly AgentSkillDefinition[]) => {
  // 第一步先按 category 合并 skill。
  // 合并后每个 category 只创建一个 specialist agent，这个 agent 拥有该 category 下所有 tools。
  const groups = new Map<AgentSkillCategory, AgentSkillDefinition[]>();

  for (const skill of skills) {
    const existing = groups.get(skill.category);

    if (existing) {
      existing.push(skill);
      continue;
    }

    groups.set(skill.category, [skill]);
  }

  return Array.from(groups.entries()).map(([category, groupedSkills]) => ({
    category,
    skills: groupedSkills,
  }));
};

const buildSpecialistThreadId = (
  threadId: string,
  category: AgentSkillCategory,
) => `${threadId}::${category}`;

// responder 是 trace 中“最终回答/最终整合”步骤的固定 id。
const RESPONDER_STEP_ID = "responder";

const extractLastAssistantText = (messages: BaseMessage[]) => {
  // LangChain agent.invoke 返回一组消息；这里取最后一条 AI 消息作为 specialist 输出。
  const finalAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.type === "ai");

  return finalAssistantMessage?.text.trim() ?? "";
};

const summarizeTraceText = (value: string, maxLength = 180) => {
  // trace 面板只展示 specialist 输出摘要，避免把完整中间结果塞进 UI。
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "已完成，但没有可展示的文本摘要。";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
};

const getSpecialistDisplayLabel = ({
  metadata,
  skills,
}: {
  metadata: ReturnType<typeof getSpecialistMetadata>;
  skills: readonly AgentSkillDefinition[];
}) => skills[0]?.categoryLabel ?? metadata.displayName;

// fixed-chain 中每个 category 最多执行一次，所以 step id 只需要 category。
const buildFixedChainStepId = (category: AgentSkillCategory) =>
  `specialist:${category}`;

// dynamic-supervisor 中同一类 specialist 可能被 supervisor 多次调用，所以 id 要带 invocationIndex。
const buildDynamicStepId = (
  category: AgentSkillCategory,
  invocationIndex: number,
) => `specialist:${category}:${invocationIndex}`;

const buildSpecialistMessageContent = ({
  executionContext,
  expectedOutput,
  skills,
  task,
  upstreamResults = [],
}: {
  executionContext: AgentExecutionContext;
  expectedOutput?: string;
  skills: readonly AgentSkillDefinition[];
  task: string;
  upstreamResults?: readonly SpecialistRunResult[];
}): MessageContent => {
  // specialist 不直接看到完整 chat history，只看到 supervisor 分配的子任务和必要上下文。
  // 这样能让 specialist 更专注，避免它越权改写最终回答。
  const textSections = [
    `Top-level intent: ${executionContext.intent}`,
    `Image role: ${executionContext.imageRole}`,
    `Skills in your scope: ${skills.map((skill) => skill.name).join(", ")}`,
    `Original user request: ${executionContext.message.trim() || "(image-only request)"}`,
    `Assigned sub-task: ${task}`,
    `Expected output: ${expectedOutput ?? "Return concise specialist notes for the supervisor."}`,
  ];

  if (upstreamResults.length > 0) {
    // fixed-chain 模式下，后续 specialist 会看到前面 specialist 的输出，形成顺序交接。
    textSections.push(
      `Upstream specialist notes:\n${formatChainResults(
        upstreamResults.map((result) => ({
          category: result.category,
          output: result.output,
        })),
      )}`,
    );
  }

  const text = textSections.join("\n\n");

  if (!executionContext.hasImages) {
    return text;
  }

  // 如果本轮带图片，specialist 也能看到图片；文本部分仍然放在第一个 part 里说明任务。
  return [
    { text, type: "text" },
    ...executionContext.images.map((image: AgentImageInput) => ({
      image_url: {
        url: image.url,
      },
      type: "image_url" as const,
    })),
  ];
};

const buildChainSynthesisMessageContent = ({
  executionContext,
  specialistResults,
}: {
  executionContext: AgentExecutionContext;
  specialistResults: readonly SpecialistRunResult[];
}): MessageContent => {
  // fixed-chain 的最后一步不是再调用 tool，而是把所有 specialist 输出交给 synthesis agent 生成最终回复。
  const text = [
    `Top-level intent: ${executionContext.intent}`,
    `Image role: ${executionContext.imageRole}`,
    `Original user request: ${executionContext.message.trim() || "(image-only request)"}`,
    "Ordered specialist outputs:",
    formatChainResults(
      specialistResults.map((result) => ({
        category: result.category,
        output: result.output,
      })),
    ),
    "Produce the final answer for the user.",
  ].join("\n\n");

  if (!executionContext.hasImages) {
    return text;
  }

  // synthesis agent 同样保留图片输入，避免最终整合阶段丢失视觉上下文。
  return [
    { text, type: "text" },
    ...executionContext.images.map((image: AgentImageInput) => ({
      image_url: {
        url: image.url,
      },
      type: "image_url" as const,
    })),
  ];
};

const createSpecialistRuntime = ({
  checkpointer,
  executionContext,
  modelFactory,
  specialistGroup,
}: {
  checkpointer: MemorySaver;
  executionContext: AgentExecutionContext;
  modelFactory: AgentModelFactory;
  specialistGroup: SpecialistGroup;
}): SpecialistRuntime => {
  const metadata = getSpecialistMetadata(specialistGroup.category);
  const modelName = modelFactory.getSpecialistModelName(specialistGroup.category);

  return {
    ...specialistGroup,
    // 每个 specialist 都是一个独立 LangChain agent：
    // - systemPrompt 限制职责范围
    // - tools 来自它负责的 skills
    // - checkpointer/thread_id 用于隔离同一会话内不同 specialist 的执行状态
    agent: createAgent({
      checkpointer,
      description: metadata.description,
      includeAgentName: "inline",
      model: modelFactory.createSpecialistModel(specialistGroup.category),
      name: metadata.agentName,
      systemPrompt: buildSpecialistSystemPrompt({
        category: specialistGroup.category,
        intent: executionContext.intent,
        skills: specialistGroup.skills,
      }),
      tools: specialistGroup.skills.flatMap((skill) => skill.tools),
      version: "v1",
    }),
    metadata,
    modelName,
  };
};

const runSpecialist = async ({
  executionContext,
  expectedOutput,
  runtime,
  signal,
  task,
  upstreamResults,
}: {
  executionContext: AgentExecutionContext;
  expectedOutput?: string;
  runtime: SpecialistRuntime;
  signal?: AbortSignal;
  task: string;
  upstreamResults?: readonly SpecialistRunResult[];
}) => {
  throwIfAborted(signal);

  // 真正执行 specialist 的统一入口。
  // dynamic-supervisor 的 tool 调用和 fixed-chain 的顺序步骤都会走这里。
  const result = await runtime.agent.invoke(
    {
      messages: [
        new HumanMessage(
          buildSpecialistMessageContent({
            executionContext,
            expectedOutput,
            skills: runtime.skills,
            task,
            upstreamResults,
          }),
        ),
      ],
    },
    {
      configurable: {
        // 同一个业务会话下，不同 specialist 使用不同 thread_id，避免 checkpoint/memory 串线。
        thread_id: buildSpecialistThreadId(
          executionContext.threadId,
          runtime.category,
        ),
      },
      signal,
    },
  );

  return {
    category: runtime.category,
    // 如果 specialist 没有返回文本，也返回一段可读占位，保证 supervisor 有稳定输入。
    output:
      extractLastAssistantText(result.messages) ||
      `${runtime.metadata.displayName} completed without a text result.`,
  } satisfies SpecialistRunResult;
};

const createDynamicSupervisorGraph = ({
  executionContext,
  specialistRuntimes,
  checkpointer,
  modelFactory,
  traceHooks,
}: {
  executionContext: AgentExecutionContext;
  specialistRuntimes: readonly SpecialistRuntime[];
  checkpointer: MemorySaver;
  modelFactory: AgentModelFactory;
  traceHooks?: AgentTraceHooks;
}) => {
  let specialistInvocationCount = 0;
  // dynamic-supervisor 的关键：把每个 specialist 包装成一个 LangChain tool。
  // supervisor agent 会在内部 tool-calling loop 中决定是否调用、调用哪个、调用几次。
  const specialistTools = specialistRuntimes.map((runtime) =>
    tool(
      async ({
        expectedOutput,
        task,
      }: z.infer<typeof specialistTaskSchema>, runtimeConfig: ToolRuntime) => {
        // tool 被调用时，立刻向 trace 发送 running step，让前端看到 specialist 开始工作。
        const traceStep: AgentTraceStep = {
          category: runtime.category,
          expectedOutput,
          id: buildDynamicStepId(runtime.category, ++specialistInvocationCount),
          kind: "specialist",
          model: runtime.modelName,
          status: "running",
          task,
          title: getSpecialistDisplayLabel(runtime),
        };

        traceHooks?.onStepUpdate?.(traceStep);

        // tool 的实际工作是调用对应 specialist agent。
        const result = await runSpecialist({
          executionContext,
          expectedOutput,
          runtime,
          signal: runtimeConfig.signal,
          task,
        });

        // specialist 返回后，更新 trace step 为 completed，并保存一段摘要。
        traceHooks?.onStepUpdate?.({
          ...traceStep,
          status: "completed",
          summary: summarizeTraceText(result.output),
        });

        return result.output;
      },
      {
        // tool description 会影响 supervisor 的路由决策：它靠这里理解何时使用这个 specialist。
        description: `${runtime.metadata.description} Available skills: ${runtime.skills.map((skill) => skill.id).join(", ")}.`,
        name: `delegate_to_${runtime.metadata.toolName}`,
        schema: specialistTaskSchema,
      },
    ),
  );

  // 返回的 supervisor agent 本身就是可 stream 的 graph。
  // 它会读 AgentService 传入的历史 messages，然后根据 tool schema 决定是否委派 specialist。
  return createAgent({
    checkpointer,
    includeAgentName: "inline",
    model: modelFactory.createSupervisorModel(),
    name: "supervisor_agent",
    systemPrompt: buildSupervisorSystemPrompt({
      imageRole: executionContext.imageRole,
      intent: executionContext.intent,
      specialists: specialistRuntimes.map((runtime) => ({
        ...runtime.metadata,
        skills: runtime.skills,
      })),
    }),
    tools: specialistTools,
    version: "v1",
  });
};

const createFixedChainGraph = ({
  checkpointer,
  executionContext,
  fixedChainSteps,
  modelFactory,
  specialistRuntimeMap,
  traceHooks,
}: {
  checkpointer: MemorySaver;
  executionContext: AgentExecutionContext;
  fixedChainSteps: readonly FixedChainStep[];
  modelFactory: AgentModelFactory;
  specialistRuntimeMap: ReadonlyMap<AgentSkillCategory, SpecialistRuntime>;
  traceHooks?: AgentTraceHooks;
}): AgentGraph => ({
  stream: async (_input, options) => {
    // fixed-chain 不让模型自由决定调用顺序，而是由代码按预设步骤依次执行 specialist。
    // 适合 coding/writing 这类阶段明确、需要质量兜底的任务。
    const specialistResults: SpecialistRunResult[] = [];

    for (const step of fixedChainSteps) {
      const runtime = specialistRuntimeMap.get(step.category);

      if (!runtime) {
        // 链路里声明了某个 category，但本轮 skill 路由没有选到对应 specialist 时，跳过该步骤。
        continue;
      }

      // fixed-chain 的 trace step 在执行前已经 planned，这里把它推进到 running。
      const traceStep: AgentTraceStep = {
        category: runtime.category,
        expectedOutput: step.expectedOutput,
        id: buildFixedChainStepId(step.category),
        kind: "specialist",
        model: runtime.modelName,
        status: "running",
        task: step.task,
        title: getSpecialistDisplayLabel(runtime),
      };

      traceHooks?.onStepUpdate?.(traceStep);

      // 每一步都能看到前面 specialist 的结果，形成 project -> architecture -> engineering -> quality 这类流水线。
      const result = await runSpecialist({
        executionContext,
        expectedOutput: step.expectedOutput,
        runtime,
        signal: options?.signal,
        task: step.task,
        upstreamResults: specialistResults,
      });

      traceHooks?.onStepUpdate?.({
        ...traceStep,
        status: "completed",
        summary: summarizeTraceText(result.output),
      });

      // 当前 specialist 输出会成为后续 specialist 和最终 synthesis 的输入。
      specialistResults.push(result);
    }

    // 所有 specialist 跑完后，用 supervisor model 做最终整合。
    // 这里不给 synthesis agent 任何 tools，避免它再进入 tool-calling loop。
    const synthesisAgent = createAgent({
      checkpointer,
      includeAgentName: "inline",
      model: modelFactory.createSupervisorModel(),
      name: "supervisor_agent",
      systemPrompt: buildChainSynthesisSystemPrompt({
        imageRole: executionContext.imageRole,
        intent: executionContext.intent,
      }),
      tools: [],
      version: "v1",
    });

    return synthesisAgent.stream(
      {
        messages: [
          new HumanMessage(
            buildChainSynthesisMessageContent({
              executionContext,
              specialistResults,
            }),
          ),
        ],
      },
      options,
    );
  },
});

const buildExecutionPlan = ({
  fixedChainSteps,
  modelFactory,
  specialistRuntimes,
}: {
  fixedChainSteps: readonly FixedChainStep[];
  modelFactory: AgentModelFactory;
  specialistRuntimes: readonly SpecialistRuntime[];
}): AgentExecutionPlan => {
  // executionPlan 是“计划视图”，给前端 trace 面板和数据库审计用。
  // 它不驱动执行，真正执行由 createFixedChainGraph/createDynamicSupervisorGraph 完成。
  const runtimeMap = new Map(
    specialistRuntimes.map((runtime) => [runtime.category, runtime] as const),
  );
  const responderModel = modelFactory.getSupervisorModelName();
  // availableSpecialists 用于告诉前端本轮可用专家、模型和 skill 列表。
  const availableSpecialists = specialistRuntimes.map((runtime) => ({
    category: runtime.category,
    label: getSpecialistDisplayLabel(runtime),
    model: runtime.modelName,
    skillIds: runtime.skills.map((skill) => skill.id),
    skillNames: runtime.skills.map((skill) => skill.name),
  }));

  if (fixedChainSteps.length > 0) {
    // fixed-chain 的 steps 可以在执行前全部列出来，所以前端一开始就能看到完整计划。
    return {
      availableSpecialists,
      executionMode: "fixed-chain",
      responder: {
        label: "最终整合",
        model: responderModel,
        stepId: RESPONDER_STEP_ID,
      },
      steps: [
        ...fixedChainSteps.flatMap((step) => {
          const runtime = runtimeMap.get(step.category);

          if (!runtime) {
            // 如果某个固定步骤没有对应 runtime，就不展示在计划里。
            return [];
          }

          return [
            {
              category: step.category,
              expectedOutput: step.expectedOutput,
              id: buildFixedChainStepId(step.category),
              kind: "specialist",
              model: runtime.modelName,
              status: "planned",
              task: step.task,
              title: getSpecialistDisplayLabel(runtime),
            } satisfies AgentTraceStep,
          ];
        }),
        // responder 是最后的整合/回答步骤。
        {
          id: RESPONDER_STEP_ID,
          kind: "responder",
          model: responderModel,
          status: "planned",
          task: "整合上游 specialist 输出，并生成最终交付。",
          title: "最终整合",
        },
      ],
    };
  }

  // dynamic-supervisor 的 specialist 调用次数和顺序要到运行时才知道。
  // 因此前置 plan 只包含 responder，后续 specialist steps 会由 traceHooks 动态插入。
  return {
    availableSpecialists,
    executionMode: "dynamic-supervisor",
    responder: {
      label: "调度与回答",
      model: responderModel,
      stepId: RESPONDER_STEP_ID,
    },
    steps: [
      {
        id: RESPONDER_STEP_ID,
        kind: "responder",
        model: responderModel,
        status: "planned",
        task: "规划 specialist 调度，并生成最终回复。",
        title: "调度与回答",
      },
    ],
  };
};

const buildAgentGraph = (
  modelFactory: AgentModelFactory,
  skills: readonly AgentSkillDefinition[],
  executionContext: AgentExecutionContext,
  checkpointer: MemorySaver,
  traceHooks?: AgentTraceHooks,
): AgentGraphBundle => {
  // buildAgentGraph 是第二层 Agent 图的总装函数。
  // AgentService 已经完成第一层路由，这里只根据 selected skills 和 intent 创建真正执行图。
  const specialistGroups = groupSkillsByCategory(skills);
  // 每个 category 创建一个 specialist runtime。
  const specialistRuntimes = specialistGroups.map((specialistGroup) =>
    createSpecialistRuntime({
      checkpointer,
      executionContext,
      modelFactory,
      specialistGroup,
    }),
  );
  // coding/writing 使用固定专家链；其他 intent 走动态 supervisor。
  const fixedChainSteps = usesFixedSpecialistChain(executionContext.intent)
    ? resolveFixedChainSteps({
        availableCategories: specialistRuntimes.map((runtime) => runtime.category),
        intent: executionContext.intent,
      })
    : [];
  // 先构造计划，再构造真实 graph。AgentService 会先把计划 trace 发给前端。
  const executionPlan = buildExecutionPlan({
    fixedChainSteps,
    modelFactory,
    specialistRuntimes,
  });

  if (fixedChainSteps.length > 0) {
    // fixed-chain 返回自定义 AgentGraph 包装对象，它的 stream 方法内部先跑 specialist，再 stream 最终整合。
    return {
      executionPlan,
      graph: createFixedChainGraph({
        checkpointer,
        executionContext,
        fixedChainSteps,
        modelFactory,
        specialistRuntimeMap: new Map(
          specialistRuntimes.map((runtime) => [runtime.category, runtime] as const),
        ),
        traceHooks,
      }),
    };
  }

  // dynamic-supervisor 直接返回 LangChain createAgent 的 supervisor，它会在内部循环调用 specialist tools。
  return {
    executionPlan,
    graph: createDynamicSupervisorGraph({
      checkpointer,
      executionContext,
      modelFactory,
      specialistRuntimes,
      traceHooks,
    }),
  };
};

@Injectable()
export class AgentGraphFactory {
  @Inject(AgentModelFactory)
  private readonly modelFactory!: AgentModelFactory;

  createGraph(
    skills: readonly AgentSkillDefinition[],
    executionContext: AgentExecutionContext,
    traceHooks?: AgentTraceHooks,
  ): AgentGraphBundle {
    // 每次请求创建一个新的 MemorySaver，当前只在本次 Agent 执行内保存 checkpoint。
    // 如果后续要跨请求恢复 LangGraph 状态，可以把这里替换成数据库型 checkpointer。
    return buildAgentGraph(
      this.modelFactory,
      skills,
      executionContext,
      new MemorySaver(),
      traceHooks,
    );
  }
}
