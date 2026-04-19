import { randomUUID } from "node:crypto";

import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  PrismaService,
  type PrismaSession,
} from "../../../../Common/Prisma/prismaService.js";
import type { Conversation } from "../../../../generated/prisma/client.js";
import {
  AGENT_INTENTS,
  type AgentRequestMode,
} from "../../../Agent/Domain/agentTypes.js";
import type {
  ConversationListResult,
  ConversationRecord,
} from "../../Domain/conversationTypes.js";

const DEFAULT_CONVERSATION_LIST_LIMIT = 20;

const isAgentRequestMode = (
  value: string | null,
): value is AgentRequestMode =>
  value !== null &&
  AGENT_INTENTS.some((intent) => intent === value);

const mapConversationRecord = (
  record: Pick<
    Conversation,
    "createdAt" | "id" | "selectedMode" | "title" | "updatedAt" | "userId"
  >,
  messageCount = 0,
): ConversationRecord => ({
  createdAt: record.createdAt.toISOString(),
  id: record.id,
  messageCount,
  ...(isAgentRequestMode(record.selectedMode)
    ? { mode: record.selectedMode }
    : {}),
  title: record.title,
  updatedAt: record.updatedAt.toISOString(),
  userId: record.userId,
});

@Injectable()
export class ConversationRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createConversation(
    input: {
      id?: string;
      mode?: AgentRequestMode;
      title?: string;
      userId: string;
    },
    session: PrismaSession = this.prisma,
  ) {
    const id = input.id ?? randomUUID();
    const record = await session.conversation.upsert({
      create: {
        id,
        selectedMode: input.mode,
        title: input.title ?? "新聊天",
        userId: input.userId,
      },
      update: {
        selectedMode: input.mode ?? undefined,
        userId: input.userId,
      },
      where: {
        id,
      },
    });

    return mapConversationRecord(record);
  }

  async updateConversationSummary(
    input: {
      conversationId: string;
      mode?: AgentRequestMode;
      title?: string;
      userId: string;
    },
    session: PrismaSession = this.prisma,
  ) {
    const existingRecord = await session.conversation.findFirst({
      where: {
        id: input.conversationId,
        userId: input.userId,
      },
    });

    if (!existingRecord) {
      throw new NotFoundException(
        `Conversation ${input.conversationId} was not found.`,
      );
    }

    const record = await session.conversation.update({
      data: {
        ...(input.mode ? { selectedMode: input.mode } : {}),
        ...(input.title && existingRecord.title === "新聊天"
          ? { title: input.title }
          : {}),
      },
      where: {
        id: input.conversationId,
      },
    });

    return mapConversationRecord(record);
  }

  async findByIdForUser(
    conversationId: string,
    userId: string,
    session: PrismaSession = this.prisma,
  ) {
    const record = await session.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Conversation ${conversationId} was not found.`,
      );
    }

    return mapConversationRecord(record);
  }

  async listByUserId(
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
      query?: string;
    } = {},
  ): Promise<ConversationListResult> {
    const take = options.limit ?? DEFAULT_CONVERSATION_LIST_LIMIT;
    const records = await this.prisma.conversation.findMany({
      include: {
        _count: {
          select: {
            messages: {
              where: {
                role: {
                  not: "system",
                },
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...(options.cursor
        ? {
            cursor: {
              id: options.cursor,
            },
            skip: 1,
          }
        : {}),
      take: take + 1,
      where: {
        ...(options.query
          ? {
              title: {
                contains: options.query,
                mode: "insensitive",
              },
            }
          : {}),
        userId,
      },
    });

    const hasMore = records.length > take;
    const nextRecords = hasMore ? records.slice(0, take) : records;
    const items = nextRecords.map((record) =>
      mapConversationRecord(record, record._count.messages),
    );

    return {
      items,
      ...(hasMore && items.length > 0
        ? { nextCursor: items.at(-1)?.id }
        : {}),
    };
  }

  async updateConversation(
    input: {
      conversationId: string;
      mode?: AgentRequestMode;
      title?: string;
      userId: string;
    },
    session: PrismaSession = this.prisma,
  ) {
    await this.findByIdForUser(input.conversationId, input.userId, session);

    const record = await session.conversation.update({
      data: {
        ...(input.mode ? { selectedMode: input.mode } : {}),
        ...(input.title ? { title: input.title } : {}),
      },
      where: {
        id: input.conversationId,
      },
    });

    const messageCount = await session.message.count({
      where: {
        conversationId: input.conversationId,
        role: {
          not: "system",
        },
      },
    });

    return mapConversationRecord(record, messageCount);
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
    session: PrismaSession = this.prisma,
  ) {
    await this.findByIdForUser(conversationId, userId, session);

    await session.conversation.delete({
      where: {
        id: conversationId,
      },
    });
  }
}
