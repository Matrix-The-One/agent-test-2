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

const isConversationSummaryMessageMetadata = (
  value: Record<string, unknown> | undefined,
): value is ConversationSummaryMessageMetadata =>
  value?.kind === CONTEXT_SUMMARY_KIND
  && typeof value.summarizedMessageCount === "number";

const mapJsonRecord = (
  value: Prisma.JsonValue | null,
): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const mapJsonImages = (value: Prisma.JsonValue): AgentImageInput[] =>
  Array.isArray(value) ? (value as AgentImageInput[]) : [];

const mapRole = (value: string): ConversationMessageRole =>
  CONVERSATION_MESSAGE_ROLES.some((role) => role === value)
    ? (value as ConversationMessageRole)
    : "assistant";

const mapConversationMessageRecord = (
  record: Message,
): ConversationMessageRecord => {
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
    const records = await this.prisma.message.findMany({
      orderBy: {
        createdAt: "asc",
      },
      ...(options.limit ? { take: options.limit } : {}),
      where: {
        conversationId,
        ...(options.includeSystemMessages ? {} : { role: { not: "system" } }),
      },
    });

    return records.map(mapConversationMessageRecord);
  }

  async getConversationContextSnapshot(
    conversationId: string,
  ): Promise<ConversationContextSnapshot> {
    const records = await this.listByConversationId(conversationId, {
      includeSystemMessages: true,
    });
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
