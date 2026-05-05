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

// 数据库存的是普通 string，这里只把合法 Agent mode 暴露给上层类型。
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
  // Repository 统一把 Date 转成 ISO string，避免 Controller/前端再处理 Date 序列化差异。
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
    // Agent 流式请求会先由前端生成 threadId；upsert 可以同时支持“首次创建”和“继续对话”。
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
    // 所有写入都按 conversationId + userId 校验，避免跨用户访问。
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
        // 自动标题只在默认“新聊天”时写入，避免覆盖用户手动重命名。
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
    // 这是会话归属校验的公共入口：找不到时直接抛 404。
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
    // 侧边栏分页：按 updatedAt 倒序展示最近对话，多取一条用于判断是否还有下一页。
    const records = await this.prisma.conversation.findMany({
      include: {
        _count: {
          select: {
            messages: {
              where: {
                // system 消息只用于上下文摘要，不算进用户可见消息数。
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
    // 用户主动更新会话标题/mode 时走这里，允许覆盖已有标题。
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
        // 返回给前端的 messageCount 只统计用户可见消息。
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
    // 删除前先做归属校验；Message 通过 schema 中的 onDelete: Cascade 自动删除。
    await this.findByIdForUser(conversationId, userId, session);

    await session.conversation.delete({
      where: {
        id: conversationId,
      },
    });
  }
}
