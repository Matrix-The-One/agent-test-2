import type { AgentSkillId } from "../../SkillCatalog/Domain/agentSkillTypes.js";

export const AGENT_INTENTS = ["chat", "writing", "coding", "image"] as const;
export const AGENT_IMAGE_ROLES = [
  "none",
  "analyze",
  "reference",
  "edit",
] as const;

export type AgentIntent = (typeof AGENT_INTENTS)[number];
export type AgentRequestMode = AgentIntent;
export type AgentImageRole = (typeof AGENT_IMAGE_ROLES)[number];

export type AgentImageInput = {
  filename?: string;
  mediaType: string;
  url: string;
};

export type AgentIntentDecision = {
  intent: AgentIntent;
  reason: string;
};

export type AgentImageRoleDecision = {
  hasImages: boolean;
  reason: string;
  role: AgentImageRole;
};

export type AgentWorkflowSkillSelection = {
  reason: string;
  skillIds: AgentSkillId[];
};
