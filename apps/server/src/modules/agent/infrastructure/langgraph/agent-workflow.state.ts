import { z } from "zod";

import {
  AGENT_SKILL_IDS,
  MAX_ROUTED_AGENT_SKILLS,
} from "../../../skill-catalog/domain/agent-skill.types.js";
import { AGENT_INTENTS } from "../../domain/agent.types.js";

const agentSkillIdSchema = z.enum(AGENT_SKILL_IDS);

export const agentWorkflowStateSchema = z.object({
  message: z.string().trim().min(1),
  threadId: z.string().uuid().optional(),
  clarification: z
    .object({
      needClarification: z.boolean(),
      question: z.string(),
      reason: z.string(),
      suggestions: z.array(z.string()).max(3),
      title: z.string(),
    })
    .default({
      needClarification: false,
      question: "",
      reason: "",
      suggestions: [],
      title: "",
    }),
  intent: z.enum(AGENT_INTENTS).default("direct-answer"),
  intentReason: z.string().default(""),
  skillSelection: z
    .object({
      reason: z.string(),
      skillIds: z.array(agentSkillIdSchema).max(MAX_ROUTED_AGENT_SKILLS),
    })
    .default({
      reason: "",
      skillIds: [],
    }),
});

export type AgentWorkflowState = z.infer<typeof agentWorkflowStateSchema>;
export type AgentWorkflowInput = Pick<AgentWorkflowState, "message" | "threadId">;

