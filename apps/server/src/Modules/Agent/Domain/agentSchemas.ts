import { z } from "zod";

import { AGENT_INTENTS } from "./agentTypes.js";

const agentChatImageInputSchema = z.object({
  filename: z.string().trim().min(1).max(255).optional(),
  mediaType: z.string().trim().startsWith("image/"),
  url: z.string().trim().min(1),
});

export const agentChatRequestSchema = z
  .object({
    images: z.array(agentChatImageInputSchema).max(4).default([]),
    message: z.string().trim().max(4000).default(""),
    mode: z.enum(AGENT_INTENTS).optional(),
    threadId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.message || value.images.length > 0) {
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "message 或 images 至少提供一个。",
      path: ["message"],
    });
  });

export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>;
