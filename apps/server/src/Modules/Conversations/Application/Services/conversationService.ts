import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../Common/Prisma/prismaService.js";
import type {
  AgentExecutionTrace,
  AgentImageInput,
  AgentRequestMode,
} from "../../../Agent/Domain/agentTypes.js";
import { UserService } from "../../../Users/Application/Services/userService.js";
import type { CreateConversationRequest } from "../../Domain/conversationSchemas.js";
import type { ConversationContextSnapshot } from "../../Domain/conversationTypes.js";
import { ConversationMessageRepository } from "../../Infrastructure/Repositories/conversationMessageRepository.js";
import { ConversationRepository } from "../../Infrastructure/Repositories/conversationRepository.js";

// ConversationService 是会话应用层门面。
// AgentService 不直接操作 Prisma，而是通过这里完成：
// 1. 会话和用户校验
// 2. user/assistant/system message 写入
// 3. 上下文快照读取
// 4. 长对话摘要保存
@Injectable()
export class ConversationService {
  constructor(
    @Inject(ConversationMessageRepository)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    @Inject(ConversationRepository)
    private readonly conversationRepository: ConversationRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(UserService)
    private readonly userService: UserService,
  ) {}

  async createConversation(input: CreateConversationRequest) {
    // 手动创建会话的入口：先保证 user 存在，再创建 conversation。
    await this.userService.ensureRuntimeUser(input.userId);

    return this.conversationRepository.createConversation({
      id: input.id,
      mode: input.mode,
      title: input.title,
      userId: input.userId,
    });
  }

  async listConversations(
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
      query?: string;
    },
  ) {
    // 侧边栏会话列表入口：确保 user 存在后，只返回该用户自己的会话。
    await this.userService.ensureRuntimeUser(userId);
    return this.conversationRepository.listByUserId(userId, options);
  }

  async getConversationMessages(userId: string, conversationId: string) {
    // 前端打开历史会话时走这里；默认不返回 system 摘要消息，只返回用户可见消息。
    await this.conversationRepository.findByIdForUser(conversationId, userId);

    return this.conversationMessageRepository.listByConversationId(conversationId);
  }

  async updateConversation(input: {
    conversationId: string;
    mode?: AgentRequestMode;
    title?: string;
    userId: string;
  }) {
    // 会话元信息更新入口，主要服务于重命名或手动切换 mode。
    await this.userService.ensureRuntimeUser(input.userId);
    return this.conversationRepository.updateConversation(input);
  }

  async deleteConversation(userId: string, conversationId: string) {
    // 删除 conversation 会通过 Prisma relation cascade 一并删除 messages。
    await this.userService.ensureRuntimeUser(userId);
    await this.conversationRepository.deleteConversation(conversationId, userId);

    return {
      conversationId,
      deleted: true,
    };
  }

  async getRecentConversationHistory(
    userId: string,
    conversationId: string,
    maxMessages: number,
  ) {
    // 简化版上下文读取：保留摘要消息和最近 N 条普通消息。
    const messages = await this.getConversationContextMessages(
      userId,
      conversationId,
    );

    if (messages.length <= maxMessages) {
      return messages;
    }

    return messages.slice(-maxMessages);
  }

  async getConversationContextSnapshot(
    userId: string,
    conversationId: string,
  ): Promise<ConversationContextSnapshot> {
    // AgentContextWindowService 使用这个快照区分：
    // - summaryMessage: 旧消息的运行中摘要
    // - summaryMessageCount: 已被摘要覆盖的普通消息数量
    // - messages: 仍可直接参与上下文窗口计算的普通消息
    await this.conversationRepository.findByIdForUser(conversationId, userId);

    return this.conversationMessageRepository.getConversationContextSnapshot(
      conversationId,
    );
  }

  async getConversationContextMessages(userId: string, conversationId: string) {
    // 组装最终上下文消息：system 摘要放在最前面，后面接尚未被摘要覆盖的普通消息。
    const snapshot = await this.getConversationContextSnapshot(userId, conversationId);
    const unsummarizedMessages =
      snapshot.summaryMessageCount > 0
        ? snapshot.messages.slice(snapshot.summaryMessageCount)
        : snapshot.messages;

    return snapshot.summaryMessage
      ? [snapshot.summaryMessage, ...unsummarizedMessages]
      : unsummarizedMessages;
  }

  async saveConversationContextSummary(input: {
    content: string;
    conversationId: string;
    summarizedMessageCount: number;
    userId: string;
  }) {
    // 长对话压缩会反复调用这里；事务保证会话归属校验和摘要 upsert 同步完成。
    await this.prisma.$transaction(async (tx) => {
      await this.conversationRepository.findByIdForUser(
        input.conversationId,
        input.userId,
        tx,
      );
      await this.conversationMessageRepository.upsertContextSummaryMessage(
        {
          content: input.content,
          conversationId: input.conversationId,
          summarizedMessageCount: input.summarizedMessageCount,
        },
        tx,
      );
    });
  }

  async prepareConversationTurn(input: {
    conversationId: string;
    images: AgentImageInput[];
    message: string;
    selectedMode?: AgentRequestMode;
    userId?: string;
  }) {
    // Agent 每次收到用户输入，第一步都走这里。
    // 这个方法的目标是让后续上下文准备阶段一定能从数据库读到“本轮用户消息”。
    const user = await this.userService.ensureRuntimeUser(input.userId);
    const derivedTitle = this.deriveConversationTitle(
      input.message,
      input.images.length,
    );

    await this.prisma.$transaction(async (tx) => {
      // 1. 新会话首次发送时创建 conversation；已有会话继续沿用同一个 id。
      await this.conversationRepository.createConversation(
        {
          id: input.conversationId,
          mode: input.selectedMode,
          title: derivedTitle,
          userId: user.id,
        },
        tx,
      );

      // 2. 保存本轮 user message，图片输入也作为 JSON 一起保存。
      await this.conversationMessageRepository.createMessage(
        {
          content: input.message,
          conversationId: input.conversationId,
          images: input.images,
          role: "user",
        },
        tx,
      );

      // 3. 更新会话摘要字段：mode 和 title 会影响侧边栏展示。
      await this.conversationRepository.updateConversationSummary(
        {
          conversationId: input.conversationId,
          mode: input.selectedMode,
          title: derivedTitle,
          userId: user.id,
        },
        tx,
      );
    });

    return user;
  }

  async saveAssistantReply(input: {
    content: string;
    conversationId: string;
    metadata?: Record<string, unknown>;
    mode?: AgentRequestMode;
    trace?: AgentExecutionTrace;
    userId: string;
  }) {
    // Agent 流式输出结束后走这里。
    // 文本内容、metadata 和 trace 都会保存到 assistant message，方便历史会话恢复 trace 面板。
    await this.prisma.$transaction(async (tx) => {
      // 1. 再次校验会话归属，防止把 assistant 回复写入不属于当前 user 的 conversation。
      await this.conversationRepository.findByIdForUser(
        input.conversationId,
        input.userId,
        tx,
      );

      // 2. 保存 assistant message；trace 是 Agent 执行过程的审计数据。
      await this.conversationMessageRepository.createMessage(
        {
          content: input.content,
          conversationId: input.conversationId,
          metadata: input.metadata,
          role: "assistant",
          trace: input.trace,
        },
        tx,
      );

      // 3. 刷新 conversation.updatedAt，并记录本轮最终 mode。
      await this.conversationRepository.updateConversationSummary(
        {
          conversationId: input.conversationId,
          mode: input.mode,
          userId: input.userId,
        },
        tx,
      );
    });
  }

  private deriveConversationTitle(message: string, imageCount: number) {
    // 首条 user message 会派生默认标题；纯图片会话用图片数量兜底。
    const normalized = message.trim().replace(/\s+/g, " ");

    if (normalized) {
      return normalized.length <= 40
        ? normalized
        : `${normalized.slice(0, 39)}…`;
    }

    if (imageCount > 0) {
      return imageCount === 1 ? "图片对话" : `${imageCount} 张图片`;
    }

    return "新聊天";
  }
}
