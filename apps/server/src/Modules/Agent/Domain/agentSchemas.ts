import { z } from "zod";

import { AGENT_INTENTS } from "./agentTypes.js";

// Agent 流式接口的运行时请求校验 schema；Controller 用 ZodValidationPipe 调用它。
const agentChatImageInputSchema = z.object({
  filename: z.string().trim().min(1).max(255).optional(),
  mediaType: z.string().trim().startsWith("image/"),
  url: z.string().trim().min(1),
});

export const agentSkillChoiceSubmitSchema = z.object({
  instruction: z.string().trim().min(1).max(1000),
  optionId: z.enum(["quick", "balanced", "deep"]),
  originalRequest: z.string().trim().min(1).max(4000),
  skillId: z.literal("interactive-delivery"),
});

export const agentChoiceIdParamSchema = z.object({
  choiceId: z.uuid(),
});

export const agentChatRequestSchema = z
  .object({
    // 当前限制最多 4 张图，避免请求体和多模态上下文不可控。
    images: z.array(agentChatImageInputSchema).max(4).default([]),
    message: z.string().trim().max(4000).default(""),
    mode: z.enum(AGENT_INTENTS).optional(),
    threadId: z.uuid().optional(),
    userId: z.uuid().optional(),
  })
  .refine((value) => Boolean(value.message || value.images.length > 0), {
    // 文本和图片不能同时为空。
    message: "message 或 images 至少提供一个。",
    path: ["message"],
  });

export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>;
export type AgentChoiceIdParam = z.infer<typeof agentChoiceIdParamSchema>;
export type AgentSkillChoiceSubmitRequest = z.infer<
  typeof agentSkillChoiceSubmitSchema
>;
