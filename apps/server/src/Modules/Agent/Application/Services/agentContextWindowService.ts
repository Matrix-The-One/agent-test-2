import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";
import {
  AGENT_CONTEXT_MAX_COMPACTION_ATTEMPTS,
  AGENT_CONTEXT_MIN_RECENT_MESSAGES_TO_KEEP,
  AGENT_CONTEXT_RECENT_MESSAGES_TO_KEEP,
  AGENT_CONTEXT_SUMMARY_MAX_CHARS,
} from "../../Domain/agentConstants.js";
import { throwIfAborted } from "../../Domain/agentAbort.js";
import type {
  AgentContextBudget,
  AgentExecutionTrace,
  AgentIntent,
} from "../../Domain/agentTypes.js";
import type { AgentSkillCategory } from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import { ConversationService } from "../../../Conversations/Application/Services/conversationService.js";
import type { ConversationMessageRecord } from "../../../Conversations/Domain/conversationTypes.js";
import { AgentModelCatalogService } from "./agentModelCatalogService.js";
import { AgentTokenCountService } from "./agentTokenCountService.js";
import { AgentModelFactory } from "../../Infrastructure/Factories/agentModelFactory.js";

// 这是 token 计数服务需要的轻量消息结构。
// 它只关心 role/text/images，不需要 message id、metadata、trace 等持久化字段。
type CountableContextMessage = {
  images?: ConversationMessageRecord["images"];
  role: "assistant" | "system" | "user";
  text: string;
};

// AgentService 最终需要两样东西：
// - messages: 真正送进 LangChain graph 的历史上下文
// - budget: 给前端 trace 面板和排查问题用的上下文预算信息
type PreparedConversationContext = {
  budget: AgentContextBudget;
  messages: ConversationMessageRecord[];
};

// 当上下文使用量超过可用预算的 82% 时，提前压缩旧消息，而不是等到完全超窗才处理。
const COMPACTION_TRIGGER_RATIO = 0.82;

// running summary 的系统提示词。
// 目标不是“总结得好看”，而是保留后续推理仍然需要的事实、约束和未完成事项。
const CONTEXT_SUMMARIZER_SYSTEM_PROMPT = `
你在维护一份长对话的运行中上下文摘要。
你的目标是把旧消息压缩成一段更短但可继续推理的事实摘要。

输出要求:
- 只保留后续回答真正需要的信息
- 优先保留: 用户目标、已确认约束、关键事实、文件路径、技术决策、未完成事项、风险与待确认点
- 删除寒暄、重复内容、冗长示例、无关推理细节
- 使用简洁中文分点输出
- 不要编造不存在的信息
- 输出控制在 12 条以内
`.trim();

@Injectable()
export class AgentContextWindowService {
  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(ConversationService)
    private readonly conversationService: ConversationService,
    @Inject(AgentModelCatalogService)
    private readonly modelCatalogService: AgentModelCatalogService,
    @Inject(AgentTokenCountService)
    private readonly tokenCountService: AgentTokenCountService,
    @Inject(AgentModelFactory)
    private readonly modelFactory: AgentModelFactory,
  ) {}

  async prepareConversationContext(input: {
    conversationId: string;
    intent: AgentIntent;
    specialistCategories: readonly AgentSkillCategory[];
    signal?: AbortSignal;
    userId: string;
  }): Promise<PreparedConversationContext> {
    // 阶段 1：先按本轮执行会用到的模型集合计算“会话历史最多能占多少 token”。
    // 多 Agent 场景可能会用多个模型，所以预算按最小上下文窗口的模型来保守计算。
    const budgetConfig = this.modelCatalogService.resolveConversationBudget({
      intent: input.intent,
      specialistCategories: input.specialistCategories,
    });
    throwIfAborted(input.signal);

    // 阶段 2：读取会话上下文快照。
    // snapshot 里同时包含：
    // - 普通 user/assistant 消息
    // - 可选的 system summary message
    // - summary 已覆盖的普通消息数量
    const snapshot = await this.conversationService.getConversationContextSnapshot(
      input.userId,
      input.conversationId,
    );
    const regularMessages = snapshot.messages;

    // summaryText 是旧消息的运行中摘要；summarizedMessageCount 表示前多少条普通消息已被摘要覆盖。
    let summaryText = snapshot.summaryMessage?.text.trim() || "";
    let summarizedMessageCount = snapshot.summaryMessageCount;

    // remainingMessages 是“还没被摘要覆盖”的普通消息，它会和 summary 一起构成模型上下文。
    let remainingMessages = this.sliceUnsummarizedMessages(
      regularMessages,
      summarizedMessageCount,
    );

    // 阶段 3：先构造一次可计数上下文并计算 token，用它判断是否要压缩。
    let contextMessages = this.buildContextMessages(summaryText, remainingMessages);
    let tokenResult = await this.tokenCountService.countConversationInputTokens({
      messages: contextMessages,
      model: budgetConfig.model,
      signal: input.signal,
    });
    let compactionApplied = false;

    // 阶段 4：如果上下文接近预算上限，循环压缩更旧的消息。
    // 这里限制最大尝试次数，避免一次请求里反复调用摘要模型导致延迟不可控。
    for (
      let attempt = 0;
      attempt < AGENT_CONTEXT_MAX_COMPACTION_ATTEMPTS
      && tokenResult.inputTokens > this.getCompactionTriggerTokens(
        budgetConfig.maxConversationTokens,
      );
      attempt += 1
    ) {
      // 候选消息只选“已经不属于最近窗口”的旧消息；最近消息尽量保留原文，减少信息损失。
      const candidateMessages = this.getCompactionCandidateMessages({
        messages: regularMessages,
        summarizedMessageCount,
      });

      if (candidateMessages.length === 0) {
        break;
      }

      throwIfAborted(input.signal);

      // 把已有 summary 和本轮候选旧消息合并成新的 summary。
      const nextSummary = await this.summarizeMessages({
        currentSummary: summaryText,
        messages: candidateMessages,
        signal: input.signal,
      });

      if (!nextSummary) {
        break;
      }

      summaryText = nextSummary;
      summarizedMessageCount += candidateMessages.length;

      // 摘要写回数据库，下一轮对话可以直接复用，不需要重复压缩同一批旧消息。
      await this.conversationService.saveConversationContextSummary({
        content: nextSummary,
        conversationId: input.conversationId,
        summarizedMessageCount,
        userId: input.userId,
      });

      // 更新摘要覆盖范围后，重新构造上下文并重新计数。
      remainingMessages = this.sliceUnsummarizedMessages(
        regularMessages,
        summarizedMessageCount,
      );
      contextMessages = this.buildContextMessages(summaryText, remainingMessages);
      tokenResult = await this.tokenCountService.countConversationInputTokens({
        messages: contextMessages,
        model: budgetConfig.model,
        signal: input.signal,
      });
      compactionApplied = true;
    }

    // 阶段 5：兜底裁剪。
    // 如果摘要后仍然超预算，说明最近消息本身太长，只能从 remainingMessages 头部开始丢弃旧消息。
    const trimmedMessages = await this.trimToBudget({
      budgetModel: budgetConfig.model,
      maxConversationTokens: budgetConfig.maxConversationTokens,
      messages: remainingMessages,
      signal: input.signal,
      summaryText,
    });

    if (trimmedMessages !== remainingMessages) {
      // 裁剪后重新计数，确保返回给前端 trace 的 usagePercent 是最终上下文的真实估算。
      remainingMessages = trimmedMessages;
      contextMessages = this.buildContextMessages(summaryText, remainingMessages);
      tokenResult = await this.tokenCountService.countConversationInputTokens({
        messages: contextMessages,
        model: budgetConfig.model,
        signal: input.signal,
      });
    }

    // 阶段 6：返回最终上下文和预算信息。
    // AgentService 会把 messages 转成 LangChain BaseMessage[]，budget 会进入 trace 面板和数据库。
    return {
      budget: {
        compaction: {
          active: Boolean(summaryText),
          applied: compactionApplied,
          strategy: Boolean(summaryText) ? "running-summary" : "none",
          summaryMessageCount: summarizedMessageCount,
        },
        contextWindowTokens: budgetConfig.spec.contextWindowTokens,
        countingMode: tokenResult.countingMode,
        inputTokens: tokenResult.inputTokens,
        maxConversationTokens: budgetConfig.maxConversationTokens,
        model: budgetConfig.model,
        reservedInstructionTokens: budgetConfig.reservedInstructionTokens,
        reservedOutputTokens: budgetConfig.reservedOutputTokens,
        usagePercent: Number(
          (
            (tokenResult.inputTokens / budgetConfig.maxConversationTokens)
            * 100
          ).toFixed(1),
        ),
      },
      messages: summaryText
        ? [
            // summary 作为 system message 放到最前面，后续模型会把它当作旧上下文事实底座。
            {
              createdAt:
                snapshot.summaryMessage?.createdAt
                ?? remainingMessages[0]?.createdAt
                ?? new Date().toISOString(),
              id: snapshot.summaryMessage?.id ?? "context-summary",
              metadata: {
                kind: "context-summary",
                summarizedMessageCount,
              },
              role: "system",
              text: summaryText,
              images: [],
            },
            ...remainingMessages,
          ]
        : remainingMessages,
    };
  }

  applyContextBudget(
    trace: AgentExecutionTrace,
    budget: AgentContextBudget,
  ): AgentExecutionTrace {
    // 保留这个 helper 是为了在已有 trace 上替换最新预算，当前主链路直接在 buildAgentTrace 时写入。
    return {
      ...trace,
      contextBudget: budget,
    };
  }

  private buildContextMessages(
    summaryText: string,
    messages: readonly ConversationMessageRecord[],
  ): CountableContextMessage[] {
    // 把完整 ConversationMessageRecord 转成 token 计数使用的轻量结构。
    // 注意：这里不改变真正要发给模型的消息，只用于计算上下文大小。
    return [
      ...(summaryText
        ? [
            {
              role: "system" as const,
              text: summaryText,
            },
          ]
        : []),
      ...messages.map((message) => ({
        ...(message.images.length > 0 ? { images: message.images } : {}),
        role: (
          message.role === "assistant"
            ? "assistant"
            : message.role === "system"
              ? "system"
              : "user"
        ) as CountableContextMessage["role"],
        text: message.text,
      })),
    ];
  }

  private getCompactionCandidateMessages(input: {
    messages: readonly ConversationMessageRecord[];
    summarizedMessageCount: number;
  }) {
    // 已摘要消息之后，还要至少保留 AGENT_CONTEXT_RECENT_MESSAGES_TO_KEEP 条最近消息原文。
    // 这样可以减少摘要误差对当前轮回答的影响。
    if (
      input.messages.length
      <= input.summarizedMessageCount + AGENT_CONTEXT_RECENT_MESSAGES_TO_KEEP
    ) {
      return [];
    }

    return input.messages.slice(
      // 从第一条尚未被摘要覆盖的消息开始。
      input.summarizedMessageCount,
      // 到最近窗口之前结束，最近消息不进入摘要候选。
      input.messages.length - AGENT_CONTEXT_RECENT_MESSAGES_TO_KEEP,
    );
  }

  private getCompactionTriggerTokens(maxConversationTokens: number) {
    // 提前触发压缩，给系统提示、specialist 中间信息和模型估算误差留余量。
    return Math.floor(maxConversationTokens * COMPACTION_TRIGGER_RATIO);
  }

  private sliceUnsummarizedMessages(
    messages: readonly ConversationMessageRecord[],
    summarizedMessageCount: number,
  ) {
    // summarizedMessageCount 之前的普通消息已经被 summary 覆盖，不能再重复放进上下文。
    return summarizedMessageCount > 0
      ? messages.slice(summarizedMessageCount)
      : [...messages];
  }

  private async summarizeMessages(input: {
    currentSummary: string;
    messages: readonly ConversationMessageRecord[];
    signal?: AbortSignal;
  }) {
    // 摘要本身也可能调用模型，所以同样支持用户中断。
    throwIfAborted(input.signal);

    // 没有配置模型时不能压缩，只能交给后续裁剪兜底。
    if (!this.config.providerConfigured) {
      return "";
    }

    // 使用低温 compaction model，目标是稳定保留事实，而不是生成有创意的摘要。
    const model = this.modelFactory.createCompactionModel();
    const response = await model.invoke([
      new SystemMessage(CONTEXT_SUMMARIZER_SYSTEM_PROMPT),
      new HumanMessage(this.buildSummaryInput(input)),
    ], {
      signal: input.signal,
    });
    const summary = this.extractMessageText(response.content).trim();

    if (!summary) {
      return "";
    }

    // 防止摘要自身无限增长；摘要太长也会占用上下文预算。
    return summary.slice(0, AGENT_CONTEXT_SUMMARY_MAX_CHARS).trim();
  }

  private buildSummaryInput(input: {
    currentSummary: string;
    messages: readonly ConversationMessageRecord[];
  }) {
    // 给摘要模型的输入包含“已有摘要 + 新增待压缩消息”。
    // 这就是 running summary：每次把旧摘要和一批新旧消息合并成一个更新后的摘要。
    return [
      input.currentSummary
        ? `已有摘要:\n${input.currentSummary}`
        : "已有摘要:\n(无)",
      "新增待压缩消息:",
      input.messages
        .map((message, index) => {
          const parts = [
            `#${index + 1}`,
            `[${message.role}]`,
            message.text.trim() || "(无文本)",
          ];

          if (message.images.length > 0) {
            // 摘要不把图片内容重新转给模型，只保留“这条消息有图片”这个事实。
            parts.push(`图片数=${message.images.length}`);
          }

          return parts.join(" ");
        })
        .join("\n"),
      "请输出新的合并摘要。",
    ].join("\n\n");
  }

  private extractMessageText(content: unknown) {
    // LangChain 模型返回的 content 可能是 string，也可能是多 part 数组。
    if (typeof content === "string") {
      return content;
    }

    if (!Array.isArray(content)) {
      return "";
    }

    return content
      .map((part) => {
        // 这里只提取 text part；图片、tool 等非文本 part 不参与 summary 文本。
        if (
          part
          && typeof part === "object"
          && "text" in part
          && typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  private async trimToBudget(input: {
    budgetModel: string;
    maxConversationTokens: number;
    messages: readonly ConversationMessageRecord[];
    signal?: AbortSignal;
    summaryText: string;
  }) {
    // 裁剪是压缩失败或仍然超窗时的最后防线。
    // 策略分两段：先尽量保留最少 4 条最近消息；如果还超，再退到至少保留 1 条。
    throwIfAborted(input.signal);

    const preferredTrimmedMessages = await this.trimMessagesToLimit({
      budgetModel: input.budgetModel,
      maxConversationTokens: input.maxConversationTokens,
      messages: input.messages,
      minMessagesToKeep: Math.min(
        input.messages.length,
        AGENT_CONTEXT_MIN_RECENT_MESSAGES_TO_KEEP,
      ),
      signal: input.signal,
      summaryText: input.summaryText,
    });

    if (
      await this.isWithinBudget({
        budgetModel: input.budgetModel,
        maxConversationTokens: input.maxConversationTokens,
        messages: preferredTrimmedMessages,
        signal: input.signal,
        summaryText: input.summaryText,
      })
    ) {
      // 保留至少 4 条最近消息后已经满足预算，直接返回。
      return preferredTrimmedMessages;
    }

    // 如果最近消息本身很长，继续裁剪到只保证至少 1 条最近消息。
    return this.trimMessagesToLimit({
      budgetModel: input.budgetModel,
      maxConversationTokens: input.maxConversationTokens,
      messages: preferredTrimmedMessages,
      minMessagesToKeep: Math.min(preferredTrimmedMessages.length, 1),
      signal: input.signal,
      summaryText: input.summaryText,
    });
  }

  private async trimMessagesToLimit(input: {
    budgetModel: string;
    maxConversationTokens: number;
    messages: readonly ConversationMessageRecord[];
    minMessagesToKeep: number;
    signal?: AbortSignal;
    summaryText: string;
  }) {
    // 从最旧的 remaining message 开始丢弃，每丢一次重新计数。
    // 这是 O(n) 次 token 计数，但 messages 数量已经被摘要窗口限制，成本可控。
    let messages = [...input.messages];

    while (messages.length > input.minMessagesToKeep) {
      throwIfAborted(input.signal);

      if (
        await this.isWithinBudget({
          budgetModel: input.budgetModel,
          maxConversationTokens: input.maxConversationTokens,
          messages,
          signal: input.signal,
          summaryText: input.summaryText,
        })
      ) {
        // 当前消息集合已经在预算内，停止裁剪。
        return messages;
      }

      // 丢弃最旧的一条未摘要消息，继续尝试。
      messages = messages.slice(1);
    }

    // 到达最低保留条数仍可能超预算；调用方会接受这个最小可用上下文。
    return messages;
  }

  private async isWithinBudget(input: {
    budgetModel: string;
    maxConversationTokens: number;
    messages: readonly ConversationMessageRecord[];
    signal?: AbortSignal;
    summaryText: string;
  }) {
    // 统一用最终形态“summary + messages”计数，避免单独算 messages 低估真实输入。
    throwIfAborted(input.signal);

    const tokenResult = await this.tokenCountService.countConversationInputTokens({
      messages: this.buildContextMessages(input.summaryText, input.messages),
      model: input.budgetModel,
      signal: input.signal,
    });

    return tokenResult.inputTokens <= input.maxConversationTokens;
  }
}
