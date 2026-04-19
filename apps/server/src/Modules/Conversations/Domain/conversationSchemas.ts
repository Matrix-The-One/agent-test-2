import { z } from "zod";

import { AGENT_INTENTS } from "../../Agent/Domain/agentTypes.js";

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const createConversationRequestSchema = z.object({
  id: z.uuid().optional(),
  mode: z.enum(AGENT_INTENTS).optional(),
  title: optionalTrimmedString(120),
  userId: z.uuid(),
});

export const conversationListQuerySchema = z.object({
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
