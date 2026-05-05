import { z } from "zod";

import { AGENT_INTENTS } from "../../Agent/Domain/agentTypes.js";

const optionalTrimmedString = (maxLength: number) =>
  // 空字符串按 undefined 处理，方便前端表单清空字段。
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const createConversationRequestSchema = z.object({
  // 前端可传入自己生成的 conversation id，保证路由和 Agent threadId 一致。
  id: z.uuid().optional(),
  mode: z.enum(AGENT_INTENTS).optional(),
  title: optionalTrimmedString(120),
  userId: z.uuid(),
});

export const conversationListQuerySchema = z.object({
  // cursor 是上一页最后一条 conversation id，Repository 用它做游标分页。
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  query: optionalTrimmedString(120),
  userId: z.uuid(),
});

export const conversationIdParamSchema = z.object({
  conversationId: z.uuid(),
});

export const conversationMessagesQuerySchema = z.object({
  userId: z.uuid(),
});

export const updateConversationRequestSchema = z
  .object({
    mode: z.enum(AGENT_INTENTS).optional(),
    title: optionalTrimmedString(120),
    userId: z.uuid(),
  })
  .refine((value) => Boolean(value.title || value.mode), {
    // PATCH 必须至少更新一个字段。
    message: "title 或 mode 至少提供一个。",
    path: ["title"],
  });

export type CreateConversationRequest = z.infer<
  typeof createConversationRequestSchema
>;

export type UpdateConversationRequest = z.infer<
  typeof updateConversationRequestSchema
>;

export type ConversationListQuery = z.infer<
  typeof conversationListQuerySchema
>;
