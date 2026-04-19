import type { AgentSkillId } from "../../skill-catalog/domain/agent-skill.types.js";

export type AgentClarificationDecision = {
  needClarification: boolean;
  question: string;
  reason: string;
  suggestions: string[];
  title: string;
};

export const AGENT_INTENTS = ["direct-answer", "skill-routing"] as const;

export type AgentIntent = (typeof AGENT_INTENTS)[number];

export type AgentIntentDecision = {
  intent: AgentIntent;
  reason: string;
};

export type AgentWorkflowSkillSelection = {
  reason: string;
  skillIds: AgentSkillId[];
};

