import {
  HumanMessage,
  type BaseMessage,
  type MessageContent,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { Inject, Injectable } from "@nestjs/common";
import { createAgent } from "langchain";
import { z } from "zod";

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

const specialistTaskSchema = z.object({
  expectedOutput: z.string().trim().min(1).max(500).optional(),
  task: z.string().trim().min(1).max(4000),
});

type BaseAgentGraph = ReturnType<typeof createAgent>;
type AgentStreamInput = Parameters<BaseAgentGraph["stream"]>[0];
type AgentStreamOptions = Parameters<BaseAgentGraph["stream"]>[1];
type AgentStreamResult = ReturnType<BaseAgentGraph["stream"]>;

type AgentGraph = {
  stream: (input: AgentStreamInput, options?: AgentStreamOptions) => AgentStreamResult;
};

type AgentGraphBundle = {
  executionPlan: AgentExecutionPlan;
  graph: AgentGraph;
};

type SpecialistGroup = {
  category: AgentSkillCategory;
  skills: AgentSkillDefinition[];
};

type SpecialistRuntime = SpecialistGroup & {
  agent: BaseAgentGraph;
  metadata: ReturnType<typeof getSpecialistMetadata>;
  modelName: string;
};

type SpecialistRunResult = {
  category: AgentSkillCategory;
  output: string;
};

const groupSkillsByCategory = (skills: readonly AgentSkillDefinition[]) => {
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

const RESPONDER_STEP_ID = "responder";

const extractLastAssistantText = (messages: BaseMessage[]) => {
  const finalAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.type === "ai");

  return finalAssistantMessage?.text.trim() ?? "";
};

const summarizeTraceText = (value: string, maxLength = 180) => {
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

const buildFixedChainStepId = (category: AgentSkillCategory) =>
  `specialist:${category}`;

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
  const textSections = [
    `Top-level intent: ${executionContext.intent}`,
    `Image role: ${executionContext.imageRole}`,
    `Skills in your scope: ${skills.map((skill) => skill.name).join(", ")}`,
    `Original user request: ${executionContext.message.trim() || "(image-only request)"}`,
    `Assigned sub-task: ${task}`,
    `Expected output: ${expectedOutput ?? "Return concise specialist notes for the supervisor."}`,
  ];

  if (upstreamResults.length > 0) {
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
  task,
  upstreamResults,
}: {
  executionContext: AgentExecutionContext;
  expectedOutput?: string;
  runtime: SpecialistRuntime;
  task: string;
  upstreamResults?: readonly SpecialistRunResult[];
}) => {
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
        thread_id: buildSpecialistThreadId(
          executionContext.threadId,
          runtime.category,
        ),
      },
    },
  );

  return {
    category: runtime.category,
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
  const specialistTools = specialistRuntimes.map((runtime) =>
    tool(
      async ({
        expectedOutput,
        task,
      }: z.infer<typeof specialistTaskSchema>) => {
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

        const result = await runSpecialist({
          executionContext,
          expectedOutput,
          runtime,
          task,
        });

        traceHooks?.onStepUpdate?.({
          ...traceStep,
          status: "completed",
          summary: summarizeTraceText(result.output),
        });

        return result.output;
      },
      {
        description: `${runtime.metadata.description} Available skills: ${runtime.skills.map((skill) => skill.id).join(", ")}.`,
        name: `delegate_to_${runtime.metadata.toolName}`,
        schema: specialistTaskSchema,
      },
    ),
  );

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
    const specialistResults: SpecialistRunResult[] = [];

    for (const step of fixedChainSteps) {
      const runtime = specialistRuntimeMap.get(step.category);

      if (!runtime) {
        continue;
      }

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

      const result = await runSpecialist({
        executionContext,
        expectedOutput: step.expectedOutput,
        runtime,
        task: step.task,
        upstreamResults: specialistResults,
      });

      traceHooks?.onStepUpdate?.({
        ...traceStep,
        status: "completed",
        summary: summarizeTraceText(result.output),
      });

      specialistResults.push(result);
    }

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
  const runtimeMap = new Map(
    specialistRuntimes.map((runtime) => [runtime.category, runtime] as const),
  );
  const responderModel = modelFactory.getSupervisorModelName();
  const availableSpecialists = specialistRuntimes.map((runtime) => ({
    category: runtime.category,
    label: getSpecialistDisplayLabel(runtime),
    model: runtime.modelName,
    skillIds: runtime.skills.map((skill) => skill.id),
    skillNames: runtime.skills.map((skill) => skill.name),
  }));

  if (fixedChainSteps.length > 0) {
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
  const specialistGroups = groupSkillsByCategory(skills);
  const specialistRuntimes = specialistGroups.map((specialistGroup) =>
    createSpecialistRuntime({
      checkpointer,
      executionContext,
      modelFactory,
      specialistGroup,
    }),
  );
  const fixedChainSteps = usesFixedSpecialistChain(executionContext.intent)
    ? resolveFixedChainSteps({
        availableCategories: specialistRuntimes.map((runtime) => runtime.category),
        intent: executionContext.intent,
      })
    : [];
  const executionPlan = buildExecutionPlan({
    fixedChainSteps,
    modelFactory,
    specialistRuntimes,
  });

  if (fixedChainSteps.length > 0) {
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
    return buildAgentGraph(
      this.modelFactory,
      skills,
      executionContext,
      new MemorySaver(),
      traceHooks,
    );
  }
}
