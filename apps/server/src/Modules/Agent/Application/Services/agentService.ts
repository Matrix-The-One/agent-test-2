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

  streamReply(payload: AgentChatRequest, signal?: AbortSignal) {
    const threadId = payload.threadId ?? randomUUID();
    const requestStartedAtMs = Date.now();
    let runtimeUserId: string | undefined;
    let traceStore: AgentTraceStore | undefined;
    let persistedTrace: AgentExecutionTrace | undefined;
    let workflow: AgentWorkflowState | undefined;

    return createUIMessageStream({
      execute: async ({ writer }) => {
        throwIfAborted(signal);

        const runtimeUser = await this.conversationService.prepareConversationTurn({
          conversationId: threadId,
          images: payload.images,
          message: payload.message,
          selectedMode: payload.mode,
          userId: payload.userId,
        });

        runtimeUserId = runtimeUser.id;

        throwIfAborted(signal);

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

        const selectedSkills = await this.agentSkillsService.getSkillsByIds(
          workflow.skillSelection.skillIds,
        );

        throwIfAborted(signal);

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

        this.assertProviderConfigured();

        const executionContext = {
          hasImages: workflow.hasImages,
          imageRole: workflow.imageRole,
          images: payload.images,
          intent: workflow.intent,
          message: payload.message,
          threadId,
        };
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

        persistedTrace = trace;
        traceStore = this.createTraceStore(trace, writer);
        const activeTraceStore = traceStore;

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
          throwIfAborted(signal);

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
        if (!runtimeUserId || !workflow) {
          return;
        }

        const persistedAssistantPayload = this.extractAssistantPayload(
          responseMessage as AssistantStreamMessage,
          traceStore?.snapshot() ?? persistedTrace,
        );

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
      onError: (error) => this.normalizeError(error),
    });
  }

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
    const normalizedMessage = message.trim();

    if (!hasImages) {
      return normalizedMessage;
    }

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
    return messages.map<BaseMessage>((message, index) => {
      if (message.role === "assistant") {
        return new AIMessage(message.text);
      }

      if (message.role === "system") {
        return new SystemMessage(message.text);
      }

      const isLatestCurrentUserMessage = index === messages.length - 1 && latestUserOverride;

      return new HumanMessage(
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
    const normalizedMessage = message.trim();

    if (images.length === 0) {
      return normalizedMessage;
    }

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
    const trace = structuredClone(initialTrace);
    const emit = () => this.writeTrace(writer, trace);

    return {
      emit,
      getStep: (stepId: string) =>
        trace.execution.steps.find((step) => step.id === stepId),
      snapshot: () => structuredClone(trace),
      updateStep: (step: AgentTraceStep) => {
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
    writer.write({
      data: structuredClone(trace),
      id: AGENT_TRACE_PART_ID,
      type: "data-agentTrace",
    });
  }

  private summarizeTraceText(text: string, maxLength = 180) {
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
    if (!value || typeof value !== "object") {
      return false;
    }

    return "execution" in value && "intent" in value && "threadId" in value;
  }
}
