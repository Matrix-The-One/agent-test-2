import { randomUUID } from "node:crypto";

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
  type MessageContent,
} from "@langchain/core/messages";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStream, type UIMessageStreamWriter } from "ai";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";
import { ConversationService } from "../../../Conversations/Application/Services/conversationService.js";
import type { ConversationMessageRecord } from "../../../Conversations/Domain/conversationTypes.js";
import { AgentSkillsService } from "../../../SkillCatalog/Application/Services/agentSkillsService.js";
import {
  isAbortError,
  throwIfAborted,
} from "../../Domain/agentAbort.js";
import type { AgentChatRequest } from "../../Domain/agentSchemas.js";
import type {
  AgentContextBudget,
  AgentExecutionPlan,
  AgentExecutionTrace,
  AgentImageInput,
  AgentTraceStep,
} from "../../Domain/agentTypes.js";
import { AgentContextWindowService } from "./agentContextWindowService.js";
import { AgentGraphFactory } from "../../Infrastructure/Factories/agentGraphFactory.js";
import { AgentWorkflowGraphFactory } from "../../Infrastructure/Factories/agentWorkflowGraphFactory.js";
import type { AgentWorkflowState } from "../../Infrastructure/LangGraph/agentWorkflowState.js";

// 前端通过这个固定 id 找到最新的 Agent 执行轨迹 data part。
const AGENT_TRACE_PART_ID = "agent-trace";

type AgentTraceWriter = UIMessageStreamWriter;

type AgentTraceStore = {
  emit: () => void;
  getStep: (stepId: string) => AgentTraceStep | undefined;
  snapshot: () => AgentExecutionTrace;
  updateStep: (step: AgentTraceStep) => void;
};

type PersistedAssistantPayload = {
  metadata?: Record<string, unknown>;
  text: string;
  trace?: AgentExecutionTrace;
};

type AssistantStreamMessage = {
  metadata?: unknown;
  parts: Array<{
    type: string;
    [key: string]: unknown;
  }>;
};

const toIsoString = (value: number) => new Date(value).toISOString();
const getDurationMs = (startedAt: string, completedAt: string) =>
  Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));

@Injectable()
export class AgentService {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  @Inject(AgentGraphFactory)
  private readonly agentGraphFactory!: AgentGraphFactory;

  @Inject(AgentWorkflowGraphFactory)
  private readonly agentWorkflowGraphFactory!: AgentWorkflowGraphFactory;

  @Inject(AgentSkillsService)
  private readonly agentSkillsService!: AgentSkillsService;

  @Inject(ConversationService)
  private readonly conversationService!: ConversationService;

  @Inject(AgentContextWindowService)
  private readonly contextWindowService!: AgentContextWindowService;

  // 一次 Agent 请求的主入口。
  // 阅读顺序：
  // 1. 创建/复用会话 id
  // 2. 返回 AI SDK UIMessageStream
  // 3. execute 阶段保存 user message、路由、准备上下文、执行 Agent graph、合并模型流
  // 4. onFinish 阶段从最终 message 中抽取文本和 trace，再保存 assistant message
  // Controller 不关心这些业务细节，只负责把这里的 UIMessageStream 转成 SSE。
  streamReply(payload: AgentChatRequest, signal?: AbortSignal) {
    // threadId 同时承担“前端 chat id”和“服务端 conversation id”的作用。
    const threadId = payload.threadId ?? randomUUID();
    const requestStartedAtMs = Date.now();
    // 下面这些变量会被 execute 和 onFinish 两个回调共享。
    // execute 负责生成和流式输出；onFinish 负责根据这些上下文做最终落库。
    let runtimeUserId: string | undefined;
    let traceStore: AgentTraceStore | undefined;
    let persistedTrace: AgentExecutionTrace | undefined;
    let workflow: AgentWorkflowState | undefined;

    return createUIMessageStream({
      execute: async ({ writer }) => {
        // 阶段 1：任何异步边界前都检查中断，避免用户停止后继续跑模型或写数据库。
        throwIfAborted(signal);

        // 阶段 2：准备会话轮次。
        // 这里会确保 user 存在、conversation 存在，并把本轮 user message 写入 messages 表。
        // 先确保用户和会话存在，并把本轮 user message 落库；后续上下文窗口会从数据库读取历史消息。
        const runtimeUser = await this.conversationService.prepareConversationTurn({
          conversationId: threadId,
          images: payload.images,
          message: payload.message,
          selectedMode: payload.mode,
          userId: payload.userId,
        });

        runtimeUserId = runtimeUser.id;

        throwIfAborted(signal);

        // 阶段 3：前置路由。
        // 这一步不调用最终回答模型，只解决“这是什么任务、有没有图、该挂哪些技能”。
        // 第一层轻量工作流只做路由：图片角色、顶层意图、候选技能，不直接生成最终回答。
        workflow = await this.agentWorkflowGraphFactory.createGraph().invoke(
          {
            images: payload.images,
            message: payload.message,
            requestedMode: payload.mode,
            threadId,
          },
          { signal },
        );

        const routingResolvedAtMs = Date.now();

        throwIfAborted(signal);

        // 阶段 4：把路由结果中的 skillIds 变成真正可执行的 skill 定义。
        // skill 定义里包含 category、routing metadata 和 LangChain tools。
        // 技能路由只保存 id，这里再解析成包含 category、tools、prompt metadata 的完整定义。
        const selectedSkills = await this.agentSkillsService.getSkillsByIds(
          workflow.skillSelection.skillIds,
        );

        throwIfAborted(signal);

        // 阶段 5：准备模型上下文。
        // 这里会读取数据库中的历史消息，计算 token，用 running summary 压缩旧消息，并返回最终可发送的消息列表。
        // 根据历史消息、模型窗口和 specialist 数量准备可发送给模型的上下文；必要时会做摘要压缩。
        const preparedConversationContext =
          await this.contextWindowService.prepareConversationContext({
            conversationId: threadId,
            intent: workflow.intent,
            signal,
            specialistCategories: Array.from(
              new Set(selectedSkills.map((skill) => skill.category)),
            ),
            userId: runtimeUser.id,
          });

        throwIfAborted(signal);

        if (workflow.intent === "image") {
          // 阶段 6A：图片意图短路。
          // 当前代码已经能识别“生成图/改图/参考图”，但还没有接入图片模型，所以这里手写一个占位文本流。
          // 当前项目只完成了图片路由识别，还没有接入真正的图片生成/改图模型，所以返回占位流。
          persistedTrace = this.buildAgentTrace({
            contextBudget: preparedConversationContext.budget,
            executionPlan: this.createImagePlaceholderExecutionPlan({
              completedAtMs: routingResolvedAtMs,
              startedAtMs: requestStartedAtMs,
            }),
            requestedMode: payload.mode,
            requestStartedAtMs,
            routingDurationMs: routingResolvedAtMs - requestStartedAtMs,
            threadId,
            workflow,
          });

          this.writeTextStreamToWriter(
            writer,
            `已识别为 image 意图, 当前图片输入角色为 ${workflow.imageRole}。服务端已经支持图片路由, 但还没有接入图片生成或改图模型。`,
            persistedTrace,
          );

          return;
        }

        // 阶段 6B：文本意图进入真正 Agent 执行。
        // 文本型 Agent 执行必须有模型供应商；图片占位分支不需要调用模型，所以检查放在这里。
        this.assertProviderConfigured();

        // executionContext 是后续 supervisor/specialist 共享的本轮事实输入。
        const executionContext = {
          hasImages: workflow.hasImages,
          imageRole: workflow.imageRole,
          images: payload.images,
          intent: workflow.intent,
          message: payload.message,
          threadId,
        };

        // 阶段 7：创建第二层执行图。
        // - coding/writing 会尽量走 fixed-chain，让 specialist 按固定顺序产出中间结果
        // - chat 等开放任务走 dynamic-supervisor，由 supervisor 动态调用 specialist tool
        // 第二层执行图会根据技能集合决定 fixed-chain 或 dynamic-supervisor，并返回可流式执行的 graph。
        const { executionPlan, graph } = this.agentGraphFactory.createGraph(
          selectedSkills,
          executionContext,
          {
            onStepUpdate: (step) => {
              traceStore?.updateStep(step);
            },
          },
        );
        const trace = this.buildAgentTrace({
          contextBudget: preparedConversationContext.budget,
          executionPlan,
          requestedMode: payload.mode,
          requestStartedAtMs,
          routingDurationMs: routingResolvedAtMs - requestStartedAtMs,
          threadId,
          workflow,
        });

        // 阶段 8：构造并立即发送 trace。
        // trace 是前端“Agent Trace”面板的数据源，同时也会被保存到 assistant message.trace。
        persistedTrace = trace;
        // traceStore 会把 specialist/responder 的状态变化持续写入 stream，前端用 data-agentTrace 展示执行面板。
        traceStore = this.createTraceStore(trace, writer);
        const activeTraceStore = traceStore;

        // 先发一次 planned trace，让前端在模型正文出现前就能展示路由和执行计划。
        activeTraceStore.emit();

        const updateResponderStep = (patch: Partial<AgentTraceStep>) => {
          const currentStep = activeTraceStore.getStep(
            executionPlan.responder.stepId,
          );

          if (!currentStep) {
            return;
          }

          activeTraceStore.updateStep({
            ...currentStep,
            ...patch,
          });
        };

        let stream: Awaited<ReturnType<typeof graph.stream>>;

        try {
          // 阶段 9：启动 LangChain/LangGraph 流式执行。
          // graph.stream 返回的是 LangChain 风格的 stream；下一步会转换成 AI SDK 前端能消费的格式。
          throwIfAborted(signal);

          // LangChain graph 接收的是 BaseMessage[]；这里把数据库消息转换为 Human/AI/SystemMessage。
          stream = await graph.stream(
            {
              messages: this.buildPersistedConversationMessages(
                preparedConversationContext.messages,
                {
                  hasImages: workflow.hasImages,
                  imageRole: workflow.imageRole,
                  images: payload.images,
                  message: payload.message,
                },
              ),
            },
            {
              // thread_id 用于 LangGraph checkpointer 区分同一会话下的 supervisor 执行状态。
              configurable: { thread_id: `${threadId}::supervisor` },
              signal,
              streamMode: ["values", "messages"],
            },
          );
        } catch (error) {
          updateResponderStep({
            status: "completed",
            summary: this.summarizeTraceText(this.normalizeError(error)),
          });
          throw error;
        }

        updateResponderStep({ status: "running" });

        // 阶段 10：把模型输出并入当前 UIMessageStream。
        // writer.merge 后，Controller 中的 pipeUIMessageStreamToResponse 会把这些 part 持续写成 SSE。
        // LangChain 的 message stream 需要转换成 AI SDK UIMessageStream，才能被前端 useChat 正确消费。
        writer.merge(
          toUIMessageStream(stream as ReadableStream, {
            onError: (error) => {
              updateResponderStep({
                status: "completed",
                summary: this.summarizeTraceText(this.normalizeError(error)),
              });
            },
            onFinal: (completion) => {
              updateResponderStep({
                status: "completed",
                summary: this.summarizeTraceText(completion),
              });
            },
          }),
        );
      },
      onFinish: async ({ responseMessage }) => {
        // 阶段 11：流结束后的数据库收尾。
        // 注意：这里是 AI SDK stream 的完成回调，不是 HTTP Controller 的 return。
        // createUIMessageStream 的收尾阶段统一处理 assistant 落库，避免流式过程中反复写数据库。
        if (!runtimeUserId || !workflow) {
          return;
        }

        // responseMessage 里包含最终文本和自定义 data-agentTrace；落库时把两者拆出来保存。
        const persistedAssistantPayload = this.extractAssistantPayload(
          responseMessage as AssistantStreamMessage,
          traceStore?.snapshot() ?? persistedTrace,
        );

        // 用户中断且没有生成任何文本时，不保存一条空 assistant 消息。
        if (signal?.aborted && !persistedAssistantPayload.text) {
          return;
        }

        await this.conversationService.saveAssistantReply({
          content: persistedAssistantPayload.text,
          conversationId: threadId,
          metadata: persistedAssistantPayload.metadata,
          mode: persistedAssistantPayload.trace?.intent ?? workflow.intent,
          trace: persistedAssistantPayload.trace,
          userId: runtimeUserId,
        });
      },
      // onError 返回的字符串会进入 AI SDK 的错误流，由 Controller 写回 SSE/HTTP 响应。
      onError: (error) => this.normalizeError(error),
    });
  }

  // 统一把底层异常转换成用户可读文本；中断属于正常控制流，不当作未知错误展示。
  normalizeError(error: unknown) {
    if (isAbortError(error)) {
      return "Request aborted.";
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Agent execution failed.";
  }

  private buildUserMessageContent({
    hasImages,
    imageRole,
    images,
    message,
  }: {
    hasImages: boolean;
    imageRole: string;
    images: AgentChatRequest["images"];
    message: string;
  }): MessageContent {
    // 构造“最新一条用户消息”的 LangChain content。
    // 有图时必须返回多模态 part 数组；无图时直接返回纯文本。
    const normalizedMessage = message.trim();

    if (!hasImages) {
      return normalizedMessage;
    }

    // 多模态消息需要显式带一个 text part；如果用户只上传图，就根据图片角色补一段默认指令。
    const text =
      normalizedMessage ||
      (imageRole === "reference"
        ? "请先理解这张参考图的风格和关键视觉元素。"
        : imageRole === "edit"
          ? "请先理解这张待编辑图片的当前内容和可修改区域。"
          : "请先分析这张图片的主要内容, 然后给出简洁结论。");

    return [
      { text, type: "text" },
      ...images.map((image: AgentChatRequest["images"][number]) => ({
        image_url: {
          url: image.url,
        },
        type: "image_url" as const,
      })),
    ];
  }

  private buildPersistedConversationMessages(
    messages: readonly ConversationMessageRecord[],
    latestUserOverride?: {
      hasImages: boolean;
      imageRole: string;
      images: AgentImageInput[];
      message: string;
    },
  ): BaseMessage[] {
    // 这一步是“数据库消息 -> LangChain 消息”的适配层。
    // Agent graph 不直接认识 ConversationMessageRecord，只认识 BaseMessage。
    // 上下文窗口服务返回的是持久化消息；模型执行前要转换成 LangChain 消息对象。
    return messages.map<BaseMessage>((message, index) => {
      if (message.role === "assistant") {
        return new AIMessage(message.text);
      }

      if (message.role === "system") {
        return new SystemMessage(message.text);
      }

      const isLatestCurrentUserMessage = index === messages.length - 1 && latestUserOverride;

      return new HumanMessage(
        // 最新用户消息使用本轮 payload 中的图片角色信息，历史消息只保留原始文本和图片。
        isLatestCurrentUserMessage
          ? this.buildUserMessageContent(latestUserOverride)
          : this.buildConversationHistoryUserMessageContent({
              images: message.images,
              message: message.text,
            }),
      );
    });
  }

  private buildConversationHistoryUserMessageContent({
    images,
    message,
  }: {
    images: AgentImageInput[];
    message: string;
  }): MessageContent {
    // 构造历史 user message。
    // 历史消息不再重新判断图片角色，只保留原始文本和图片 URL 作为上下文。
    const normalizedMessage = message.trim();

    if (images.length === 0) {
      return normalizedMessage;
    }

    // 历史图片消息没有本轮 imageRole 判断结果，只作为普通上下文图片传回模型。
    return [
      {
        text: normalizedMessage || "用户上传了图片作为本轮对话上下文。",
        type: "text",
      },
      ...images.map((image) => ({
        image_url: {
          url: image.url,
        },
        type: "image_url" as const,
      })),
    ];
  }

  private assertProviderConfigured() {
    // 没有 OPENAI_API_KEY 时，服务端仍可完成路由和图片占位，但不能调用文本模型。
    if (this.config.providerConfigured) {
      return;
    }

    throw new ServiceUnavailableException(
      "OPENAI_API_KEY is missing. Add it to apps/server/.env.agent before using the agent endpoint.",
    );
  }

  private writeTextStreamToWriter(
    writer: AgentTraceWriter,
    text: string,
    trace?: AgentExecutionTrace,
  ) {
    const textId = randomUUID();
    // AI SDK UIMessageStream 的文本结构是 start -> text-start -> text-delta* -> text-end -> finish。
    // 手写一个最小 AI SDK 文本流，用于 image 占位等不经过 LangChain graph 的分支。
    writer.write({ type: "start" });

    if (trace) {
      this.writeTrace(writer, trace);
    }

    writer.write({ id: textId, type: "text-start" });

    for (const chunk of this.chunkText(text)) {
      writer.write({
        delta: chunk,
        id: textId,
        type: "text-delta",
      });
    }

    writer.write({ id: textId, type: "text-end" });
    writer.write({
      finishReason: "stop",
      type: "finish",
    });
  }

  private chunkText(text: string) {
    // 占位分支没有真实模型 token 流，这里切小块是为了让前端表现仍接近流式输出。
    const normalizedText = text.trim();

    if (normalizedText.length <= 12) {
      return [normalizedText];
    }

    const chunks: string[] = [];

    for (let index = 0; index < normalizedText.length; index += 12) {
      chunks.push(normalizedText.slice(index, index + 12));
    }

    return chunks;
  }

  private buildAgentTrace({
    contextBudget,
    executionPlan,
    requestedMode,
    requestStartedAtMs,
    routingDurationMs,
    threadId,
    workflow,
  }: {
    contextBudget: AgentContextBudget;
    executionPlan: AgentExecutionPlan;
    requestedMode?: AgentChatRequest["mode"];
    requestStartedAtMs: number;
    routingDurationMs: number;
    threadId: string;
    workflow: Pick<
      AgentWorkflowState,
      | "hasImages"
      | "imageRole"
      | "imageRoleReason"
      | "intent"
      | "intentReason"
      | "skillSelection"
    >;
  }): AgentExecutionTrace {
    // 从 workflow + context budget + execution plan 汇总出完整 trace。
    // trace 不参与模型推理，主要服务于前端可观测性和后续问题排查。
    // trace 是给前端和数据库共用的执行审计信息：路由结果、上下文预算、执行计划都放在这里。
    const startedAt = toIsoString(requestStartedAtMs);
    const updatedAt = toIsoString(Date.now());
    const totalDurationMs = executionPlan.steps.every(
      (step) => step.status === "completed",
    )
      ? Math.max(0, Date.now() - requestStartedAtMs)
      : undefined;

    return {
      execution: structuredClone(executionPlan),
      hasImages: workflow.hasImages,
      imageRole: workflow.imageRole,
      intent: workflow.intent,
      requestedMode,
      routingDurationMs,
      routing: {
        imageRoleReason: workflow.imageRoleReason,
        intentReason: workflow.intentReason,
        skillIds: [...workflow.skillSelection.skillIds],
        skillSelectionReason: workflow.skillSelection.reason,
      },
      contextBudget,
      startedAt,
      threadId,
      totalDurationMs,
      updatedAt,
    };
  }

  private createImagePlaceholderExecutionPlan({
    completedAtMs,
    startedAtMs,
  }: {
    completedAtMs: number;
    startedAtMs: number;
  }): AgentExecutionPlan {
    // image-placeholder 是一种合法 executionMode，方便前端用同一套 trace UI 展示图片占位结果。
    const startedAt = toIsoString(startedAtMs);
    const completedAt = toIsoString(completedAtMs);
    const durationMs = Math.max(0, completedAtMs - startedAtMs);

    return {
      availableSpecialists: [],
      executionMode: "image-placeholder",
      responder: {
        label: "图片执行占位",
        model: "未接入图片模型",
        stepId: "responder",
      },
      steps: [
        {
          id: "responder",
          completedAt,
          durationMs,
          kind: "responder",
          model: "未接入图片模型",
          startedAt,
          status: "completed",
          summary:
            "已完成图片角色和意图识别，但当前服务端还没有接入图片生成或改图模型。",
          title: "图片执行占位",
        },
      ],
    };
  }

  private createTraceStore(
    initialTrace: AgentExecutionTrace,
    writer: AgentTraceWriter,
  ): AgentTraceStore {
    // AgentGraphFactory 只通过 onStepUpdate 回调告诉我们“某个步骤变了”。
    // 这里负责把局部 step patch 合并回完整 trace，并立刻 emit 到前端。
    // traceStore 保留一份可变副本；每次步骤状态变化后立刻写入 stream，形成实时执行面板。
    const trace = structuredClone(initialTrace);
    const emit = () => this.writeTrace(writer, trace);

    return {
      emit,
      getStep: (stepId: string) =>
        trace.execution.steps.find((step) => step.id === stepId),
      snapshot: () => structuredClone(trace),
      updateStep: (step: AgentTraceStep) => {
        // 每次更新都补齐 startedAt/completedAt/durationMs，让前端不用自己推断耗时。
        const nowMs = Date.now();
        const nowIso = toIsoString(nowMs);
        const existingIndex = trace.execution.steps.findIndex(
          (currentStep) => currentStep.id === step.id,
        );
        const existingStep =
          existingIndex >= 0 ? trace.execution.steps[existingIndex] : undefined;
        const startedAt =
          step.status === "running"
            ? existingStep?.startedAt ?? step.startedAt ?? nowIso
            : existingStep?.startedAt ?? step.startedAt;
        const completedAt =
          step.status === "completed"
            ? existingStep?.completedAt ?? step.completedAt ?? nowIso
            : step.completedAt ?? existingStep?.completedAt;
        const nextStep: AgentTraceStep = {
          ...existingStep,
          ...step,
          ...(startedAt ? { startedAt } : {}),
          ...(completedAt ? { completedAt } : {}),
          ...(step.status === "completed"
            ? {
                durationMs:
                  step.durationMs ??
                  (startedAt && completedAt
                    ? getDurationMs(startedAt, completedAt)
                    : existingStep?.durationMs),
              }
            : {}),
        };

        if (existingIndex >= 0) {
          trace.execution.steps[existingIndex] = nextStep;
          trace.updatedAt = nowIso;
          if (
            trace.execution.steps.every(
              (currentStep) => currentStep.status === "completed",
            )
          ) {
            trace.totalDurationMs = getDurationMs(trace.startedAt, nowIso);
          }
          emit();
          return;
        }

        const responderIndex = trace.execution.steps.findIndex(
          (currentStep) => currentStep.kind === "responder",
        );

        // 动态 supervisor 模式下，specialist 步骤是运行时才出现的，需要插到最终回答步骤之前。
        if (nextStep.kind === "specialist" && responderIndex >= 0) {
          trace.execution.steps.splice(responderIndex, 0, nextStep);
        } else {
          trace.execution.steps.push(nextStep);
        }

        trace.updatedAt = nowIso;
        if (
          trace.execution.steps.every(
            (currentStep) => currentStep.status === "completed",
          )
        ) {
          trace.totalDurationMs = getDurationMs(trace.startedAt, nowIso);
        }

        emit();
      },
    };
  }

  private writeTrace(writer: AgentTraceWriter, trace: AgentExecutionTrace) {
    // data-agentTrace 是自定义 UIMessage data part；前端 messageUtils 会按这个 type 取出执行轨迹。
    writer.write({
      data: structuredClone(trace),
      id: AGENT_TRACE_PART_ID,
      type: "data-agentTrace",
    });
  }

  private summarizeTraceText(text: string, maxLength = 180) {
    // trace 面板只展示步骤摘要，不保存完整模型输出，避免面板过长。
    const normalizedText = text.trim().replace(/\s+/g, " ");

    if (!normalizedText) {
      return "已完成，但没有可展示的文本摘要。";
    }

    if (normalizedText.length <= maxLength) {
      return normalizedText;
    }

    return `${normalizedText.slice(0, maxLength - 1)}…`;
  }

  private extractAssistantPayload(
    responseMessage: AssistantStreamMessage,
    fallbackTrace?: AgentExecutionTrace,
  ): PersistedAssistantPayload {
    // AI SDK 的最终 responseMessage 是 parts 结构；保存到数据库前要拼出纯文本和最后一份 trace。
    const text = responseMessage.parts
      .filter(
        (
          part,
        ): part is { text: string; type: "text" } =>
          part.type === "text" && typeof part.text === "string",
      )
      .map((part) => part.text)
      .join("")
      .trim();
    const tracePart = [...responseMessage.parts].reverse().find(
      (
        part,
      ): part is { data: unknown; type: "data-agentTrace" } =>
        part.type === "data-agentTrace" && "data" in part,
    );
    const metadata =
      responseMessage.metadata &&
      typeof responseMessage.metadata === "object" &&
      !Array.isArray(responseMessage.metadata)
        ? (responseMessage.metadata as Record<string, unknown>)
        : undefined;

    return {
      ...(metadata ? { metadata } : {}),
      text,
      trace:
        tracePart && this.isAgentExecutionTrace(tracePart.data)
          ? tracePart.data
          : fallbackTrace,
    };
  }

  private isAgentExecutionTrace(value: unknown): value is AgentExecutionTrace {
    // 数据库和 UIMessage data part 都是 unknown/JSON，落库前用轻量结构检查兜底。
    if (!value || typeof value !== "object") {
      return false;
    }

    return "execution" in value && "intent" in value && "threadId" in value;
  }
}
