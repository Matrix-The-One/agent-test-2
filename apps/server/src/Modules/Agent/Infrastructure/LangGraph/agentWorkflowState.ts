import { z } from "zod";

import {
  AGENT_SKILL_IDS,
  MAX_ROUTED_AGENT_SKILLS,
} from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import { AGENT_IMAGE_ROLES, AGENT_INTENTS } from "../../Domain/agentTypes.js";

const agentSkillIdSchema = z.enum(AGENT_SKILL_IDS);
const agentImageInputSchema = z.object({
  filename: z.string().trim().min(1).max(255).optional(),
  mediaType: z.string().trim().startsWith("image/"),
  url: z.string().trim().min(1),
});

export const agentWorkflowStateSchema = z.object({
  hasImages: z.boolean().default(false),
  imageRole: z.enum(AGENT_IMAGE_ROLES).default("none"),
  imageRoleReason: z.string().default(""),
  images: z.array(agentImageInputSchema).max(4).default([]),
  message: z.string().trim().max(4000).default(""),
  requestedMode: z.enum(AGENT_INTENTS).optional(),
  threadId: z.string().uuid().optional(),
  intent: z.enum(AGENT_INTENTS).default("chat"),
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
export type AgentWorkflowInput = Pick<
  AgentWorkflowState,
  "images" | "message" | "requestedMode" | "threadId"
>;
