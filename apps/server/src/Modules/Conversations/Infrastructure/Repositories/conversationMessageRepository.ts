import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import {
  PrismaService,
  type PrismaSession,
} from "../../../../Common/Prisma/prismaService.js";
import { Prisma, type Message } from "../../../../generated/prisma/client.js";
import type {
  AgentExecutionTrace,
  AgentImageInput,
} from "../../../Agent/Domain/agentTypes.js";
import type {
  ConversationContextSnapshot,
  ConversationMessageRecord,
  ConversationMessageRole,
  ConversationSummaryMessageMetadata,
} from "../../Domain/conversationTypes.js";

const CONVERSATION_MESSAGE_ROLES = [
  "system",
  "user",
  "assistant",
] as const;
const CONTEXT_SUMMARY_KIND = "context-summary";

// system role 里可能有多种系统消息；只有带 context-summary metadata 的才代表长对话摘要。
const isConversationSummaryMessageMetadata = (
  value: Record<string, unknown> | undefined,
): value is ConversationSummaryMessageMetadata =>
  value?.kind === CONTEXT_SUMMARY_KIND
  && typeof value.summarizedMessageCount === "number";

const mapJsonRecord = (
  value: Prisma.JsonValue | null,
): Record<string, unknown> | undefined =>
  // Prisma JsonValue 需要先收窄，避免把数组或 null 当成 metadata/trace 对象。
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const mapJsonImages = (value: Prisma.JsonValue): AgentImageInput[] =>
  // images 在数据库中是 JSONB，读取时恢复成 AgentImageInput[] 给 Agent 和前端复用。
  Array.isArray(value) ? (value as AgentImageInput[]) : [];

const mapRole = (value: string): ConversationMessageRole =>
  // 非法历史 role 做保守兜底，避免脏数据破坏上层渲染。
  CONVERSATION_MESSAGE_ROLES.some((role) => role === value)
    ? (value as ConversationMessageRole)
    : "assistant";

const mapConversationMessageRecord = (
  record: Message,
): ConversationMessageRecord => {
  // 数据库 Message 是 Prisma 结构；上层只消费领域结构 ConversationMessageRecord。
  const metadata = mapJsonRecord(record.metadata);
  const trace = mapJsonRecord(record.trace);

  return {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    images: mapJsonImages(record.images),
    ...(metadata ? { metadata } : {}),
    role: mapRole(record.role),
    text: record.content,
    ...(trace ? { trace: trace as AgentExecutionTrace } : {}),
  };
};

@Injectable()
export class ConversationMessageRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createMessage(
    input: {
      content: string;
      conversationId: string;
      id?: string;
      images?: AgentImageInput[];
      metadata?: Record<string, unknown>;
      role: ConversationMessageRole;
      trace?: AgentExecutionTrace;
    },
    session: PrismaSession = this.prisma,
  ) {
    const id = input.id ?? randomUUID();
    // user/assistant/system 三类消息共用同一张表；metadata、images、trace 都以 JSONB 保存。
    const record = await session.message.create({
      data: {
        content: input.content,
        conversationId: input.conversationId,
        id,
        images: (input.images ?? []) as Prisma.InputJsonValue,
        ...(input.metadata
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
        role: input.role,
        ...(input.trace ? { trace: input.trace as Prisma.InputJsonValue } : {}),
      },
    });

    return mapConversationMessageRecord(record);
  }

  async listByConversationId(
    conversationId: string,
    options: {
      includeSystemMessages?: boolean;
      limit?: number;
    } = {},
  ) {
    // 历史消息按创建时间正序返回，确保重新喂给模型时保持真实对话顺序。
    const records = await this.prisma.message.findMany({
      orderBy: {
        createdAt: "asc",
      },
      ...(options.limit ? { take: options.limit } : {}),
      where: {
        conversationId,
        // 普通历史展示默认隐藏 system 摘要；上下文构建时会显式 includeSystemMessages。
        ...(options.includeSystemMessages ? {} : { role: { not: "system" } }),
      },
    });

    return records.map(mapConversationMessageRecord);
  }

  async getConversationContextSnapshot(
    conversationId: string,
  ): Promise<ConversationContextSnapshot> {
    // 上下文快照会读取 system 摘要和普通消息，供 AgentContextWindowService 做 token 预算。
    const records = await this.listByConversationId(conversationId, {
      includeSystemMessages: true,
    });
    // 摘要消息不是普通对话内容，它记录“前 N 条普通消息已经被压缩成这段 summary”。
    const summaryMessage =
      records.find(
        (record) =>
          record.role === "system"
          && isConversationSummaryMessageMetadata(record.metadata),
      ) ?? null;
    const summaryMessageCount =
      summaryMessage && isConversationSummaryMessageMetadata(summaryMessage.metadata)
        ? summaryMessage.metadata.summarizedMessageCount
        : 0;
    const messages = records.filter(
      (record) =>
        // 返回 messages 时排除摘要 system 消息，避免它同时以 summary 和普通消息两种身份出现。
        record.role !== "system"
        || !isConversationSummaryMessageMetadata(record.metadata),
    );

    return {
      messages,
      summaryMessage,
      summaryMessageCount,
    };
  }

  async upsertContextSummaryMessage(
    input: {
      content: string;
      conversationId: string;
      summarizedMessageCount: number;
    },
    session: PrismaSession = this.prisma,
  ) {
    // 每个 conversation 只维护一条 running summary；后续压缩会更新这条 system message。
    const existingSummaryMessage = await session.message.findFirst({
      where: {
        conversationId: input.conversationId,
        role: "system",
      },
    });
    const metadata = {
      kind: CONTEXT_SUMMARY_KIND,
      summarizedMessageCount: input.summarizedMessageCount,
    } satisfies ConversationSummaryMessageMetadata;

    if (existingSummaryMessage) {
      // 已有摘要时覆盖内容和 summarizedMessageCount，表示摘要覆盖范围向后推进。
      const record = await session.message.update({
        data: {
          content: input.content,
          metadata: metadata as Prisma.InputJsonValue,
        },
        where: {
          id: existingSummaryMessage.id,
        },
      });

      return mapConversationMessageRecord(record);
    }

    // 首次触发压缩时创建 system 摘要消息。
    const record = await session.message.create({
      data: {
        content: input.content,
        conversationId: input.conversationId,
        id: randomUUID(),
        metadata: metadata as Prisma.InputJsonValue,
        role: "system",
      },
    });

    return mapConversationMessageRecord(record);
  }
}
