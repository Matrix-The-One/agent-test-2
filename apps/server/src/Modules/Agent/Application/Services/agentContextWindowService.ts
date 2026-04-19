import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";
import {
  AGENT_CONTEXT_MAX_COMPACTION_ATTEMPTS,
  AGENT_CONTEXT_MIN_RECENT_MESSAGES_TO_KEEP,
  AGENT_CONTEXT_RECENT_MESSAGES_TO_KEEP,
  AGENT_CONTEXT_SUMMARY_MAX_CHARS,
} from "../../Domain/agentConstants.js";
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

type CountableContextMessage = {
  images?: ConversationMessageRecord["images"];
  role: "assistant" | "system" | "user";
  text: string;
};

type PreparedConversationContext = {
  budget: AgentContextBudget;
  messages: ConversationMessageRecord[];
};

const COMPACTION_TRIGGER_RATIO = 0.82;

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
    userId: string;
  }): Promise<PreparedConversationContext> {
    const budgetConfig = this.modelCatalogService.resolveConversationBudget({
      intent: input.intent,
      specialistCategories: input.specialistCategories,
    });
    const snapshot = await this.conversationService.getConversationContextSnapshot(
      input.userId,
      input.conversationId,
    );
    const regularMessages = snapshot.messages;
    let summaryText = snapshot.summaryMessage?.text.trim() || "";
    let summarizedMessageCount = snapshot.summaryMessageCount;
    let remainingMessages = this.sliceUnsummarizedMessages(
      regularMessages,
      summarizedMessageCount,
    );
    let contextMessages = this.buildContextMessages(summaryText, remainingMessages);
    let tokenResult = await this.tokenCountService.countConversationInputTokens({
      messages: contextMessages,
      model: budgetConfig.model,
    });
    let compactionApplied = false;

    for (
      let attempt = 0;
      attempt < AGENT_CONTEXT_MAX_COMPACTION_ATTEMPTS
      && tokenResult.inputTokens > this.getCompactionTriggerTokens(
        budgetConfig.maxConversationTokens,
      );
      attempt += 1
    ) {
      const candidateMessages = this.getCompactionCandidateMessages({
        messages: regularMessages,
        summarizedMessageCount,
      });

      if (candidateMessages.length === 0) {
        break;
      }

      const nextSummary = await this.summarizeMessages({
        currentSummary: summaryText,
        messages: candidateMessages,
      });

      if (!nextSummary) {
        break;
      }

      summaryText = nextSummary;
      summarizedMessageCount += candidateMessages.length;
      await this.conversationService.saveConversationContextSummary({
        content: nextSummary,
        conversationId: input.conversationId,
        summarizedMessageCount,
        userId: input.userId,
      });
      remainingMessages = this.sliceUnsummarizedMessages(
        regularMessages,
        summarizedMessageCount,
      );
      contextMessages = this.buildContextMessages(summaryText, remainingMessages);
      tokenResult = await this.tokenCountService.countConversationInputTokens({
        messages: contextMessages,
        model: budgetConfig.model,
      });
      compactionApplied = true;
    }

    const trimmedMessages = await this.trimToBudget({
      budgetModel: budgetConfig.model,
      maxConversationTokens: budgetConfig.maxConversationTokens,
      messages: remainingMessages,
      summaryText,
    });

    if (trimmedMessages !== remainingMessages) {
      remainingMessages = trimmedMessages;
      contextMessages = this.buildContextMessages(summaryText, remainingMessages);
      tokenResult = await this.tokenCountService.countConversationInputTokens({
        messages: contextMessages,
        model: budgetConfig.model,
      });
    }

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
    return {
      ...trace,
      contextBudget: budget,
    };
  }

  private buildContextMessages(
    summaryText: string,
    messages: readonly ConversationMessageRecord[],
  ): CountableContextMessage[] {
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
    if (
      input.messages.length
      <= input.summarizedMessageCount + AGENT_CONTEXT_RECENT_MESSAGES_TO_KEEP
    ) {
      return [];
    }

    return input.messages.slice(
      input.summarizedMessageCount,
      input.messages.length - AGENT_CONTEXT_RECENT_MESSAGES_TO_KEEP,
    );
  }

  private getCompactionTriggerTokens(maxConversationTokens: number) {
    return Math.floor(maxConversationTokens * COMPACTION_TRIGGER_RATIO);
  }

  private sliceUnsummarizedMessages(
    messages: readonly ConversationMessageRecord[],
    summarizedMessageCount: number,
  ) {
    return summarizedMessageCount > 0
      ? messages.slice(summarizedMessageCount)
      : [...messages];
  }

  private async summarizeMessages(input: {
    currentSummary: string;
    messages: readonly ConversationMessageRecord[];
  }) {
    if (!this.config.providerConfigured) {
      return "";
    }

    const model = this.modelFactory.createCompactionModel();
    const response = await model.invoke([
      new SystemMessage(CONTEXT_SUMMARIZER_SYSTEM_PROMPT),
      new HumanMessage(this.buildSummaryInput(input)),
    ]);
    const summary = this.extractMessageText(response.content).trim();

    if (!summary) {
      return "";
    }

    return summary.slice(0, AGENT_CONTEXT_SUMMARY_MAX_CHARS).trim();
  }

  private buildSummaryInput(input: {
    currentSummary: string;
    messages: readonly ConversationMessageRecord[];
  }) {
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
            parts.push(`图片数=${message.images.length}`);
          }

          return parts.join(" ");
        })
        .join("\n"),
      "请输出新的合并摘要。",
    ].join("\n\n");
  }

  private extractMessageText(content: unknown) {
    if (typeof content === "string") {
      return content;
    }

    if (!Array.isArray(content)) {
      return "";
    }

    return content
      .map((part) => {
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
    summaryText: string;
  }) {
    const preferredTrimmedMessages = await this.trimMessagesToLimit({
      budgetModel: input.budgetModel,
      maxConversationTokens: input.maxConversationTokens,
      messages: input.messages,
      minMessagesToKeep: Math.min(
        input.messages.length,
        AGENT_CONTEXT_MIN_RECENT_MESSAGES_TO_KEEP,
      ),
      summaryText: input.summaryText,
    });

    if (
      await this.isWithinBudget({
        budgetModel: input.budgetModel,
        maxConversationTokens: input.maxConversationTokens,
        messages: preferredTrimmedMessages,
        summaryText: input.summaryText,
      })
    ) {
      return preferredTrimmedMessages;
    }

    return this.trimMessagesToLimit({
      budgetModel: input.budgetModel,
      maxConversationTokens: input.maxConversationTokens,
      messages: preferredTrimmedMessages,
      minMessagesToKeep: Math.min(preferredTrimmedMessages.length, 1),
      summaryText: input.summaryText,
    });
  }

  private async trimMessagesToLimit(input: {
    budgetModel: string;
    maxConversationTokens: number;
    messages: readonly ConversationMessageRecord[];
    minMessagesToKeep: number;
    summaryText: string;
  }) {
    let messages = [...input.messages];

    while (messages.length > input.minMessagesToKeep) {
      if (
        await this.isWithinBudget({
          budgetModel: input.budgetModel,
          maxConversationTokens: input.maxConversationTokens,
          messages,
          summaryText: input.summaryText,
        })
      ) {
        return messages;
      }

      messages = messages.slice(1);
    }

    return messages;
  }

  private async isWithinBudget(input: {
    budgetModel: string;
    maxConversationTokens: number;
    messages: readonly ConversationMessageRecord[];
    summaryText: string;
  }) {
    const tokenResult = await this.tokenCountService.countConversationInputTokens({
      messages: this.buildContextMessages(input.summaryText, input.messages),
      model: input.budgetModel,
    });

    return tokenResult.inputTokens <= input.maxConversationTokens;
  }
}
