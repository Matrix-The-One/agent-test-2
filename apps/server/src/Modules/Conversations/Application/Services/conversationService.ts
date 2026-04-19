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
    await this.userService.ensureRuntimeUser(userId);
    return this.conversationRepository.listByUserId(userId, options);
  }

  async getConversationMessages(userId: string, conversationId: string) {
    await this.conversationRepository.findByIdForUser(conversationId, userId);

    return this.conversationMessageRepository.listByConversationId(conversationId);
  }

  async updateConversation(input: {
    conversationId: string;
    mode?: AgentRequestMode;
    title?: string;
    userId: string;
  }) {
    await this.userService.ensureRuntimeUser(input.userId);
    return this.conversationRepository.updateConversation(input);
  }

  async deleteConversation(userId: string, conversationId: string) {
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
    await this.conversationRepository.findByIdForUser(conversationId, userId);

    return this.conversationMessageRepository.getConversationContextSnapshot(
      conversationId,
    );
  }

  async getConversationContextMessages(userId: string, conversationId: string) {
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
    const user = await this.userService.ensureRuntimeUser(input.userId);
    const derivedTitle = this.deriveConversationTitle(
      input.message,
      input.images.length,
    );

    await this.prisma.$transaction(async (tx) => {
      await this.conversationRepository.createConversation(
        {
          id: input.conversationId,
          mode: input.selectedMode,
          title: derivedTitle,
          userId: user.id,
        },
        tx,
      );

      await this.conversationMessageRepository.createMessage(
        {
          content: input.message,
          conversationId: input.conversationId,
          images: input.images,
          role: "user",
        },
        tx,
      );

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
    await this.prisma.$transaction(async (tx) => {
      await this.conversationRepository.findByIdForUser(
        input.conversationId,
        input.userId,
        tx,
      );

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
