import type { StructuredToolInterface } from "@langchain/core/tools";

export const AGENT_SKILL_IDS = [
  "project-context",
  "solution-architecture",
  "delivery-planning",
  "quality-guard",
  "content-creation",
  "code-engineering",
  "document-production",
] as const;

export const MAX_ROUTED_AGENT_SKILLS = 5;

export type AgentSkillId = (typeof AGENT_SKILL_IDS)[number];

export type AgentSkillCategory =
  | "project"
  | "architecture"
  | "delivery"
  | "quality"
  | "content"
  | "engineering"
  | "document";

export type AgentSkillPopularity = "core" | "popular";

export type AgentSkillDefinition = {
  id: AgentSkillId;
  name: string;
  description: string;
  category: AgentSkillCategory;
  categoryLabel: string;
  popularity: AgentSkillPopularity;
  tags: string[];
  routingHints: string[];
  useCases: string[];
  tools: StructuredToolInterface[];
};

export type AgentSkillSelection = {
  reason: string;
  skillIds: AgentSkillId[];
  skills: AgentSkillDefinition[];
};

export type PublicAgentSkill = Omit<
  AgentSkillDefinition,
  "routingHints" | "tools"
> & {
  toolNames: string[];
};
