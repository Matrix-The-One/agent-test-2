import { z } from "zod";

export const agentChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  threadId: z.string().uuid().optional(),
});

export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>;
