import type { StructuredToolInterface } from "@langchain/core/tools";

// Skill 是 Agent 可路由的能力单元；每个 skill 可以带 0 到多个 LangChain tools。
export const AGENT_SKILL_IDS = [
  "project-context",
  "workspace-inspection",
  "solution-architecture",
  "delivery-planning",
  "quality-guard",
  "content-creation",
  "file-creation",
  "code-engineering",
  "runtime-verification",
  "data-processing",
  "document-production",
  "amap-maps",
] as const;

export const MAX_ROUTED_AGENT_SKILLS = 5;

export type AgentSkillId = (typeof AGENT_SKILL_IDS)[number];

// category 决定 specialist 分组；同 category 的多个 skill 会合并成一个 specialist agent。
export type AgentSkillCategory =
  | "project"
  | "location"
  | "architecture"
  | "delivery"
  | "quality"
  | "content"
  | "artifact"
  | "engineering"
  | "document";

export type AgentSkillPopularity = "core" | "popular";

export type AgentSkillDefinition = {
  // 完整 skill 定义只在服务端内部使用，tools 不会直接暴露给前端。
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
  // 前端技能目录只需要展示信息和 toolNames，不能拿到可执行 tool 对象。
  AgentSkillDefinition,
  "routingHints" | "tools"
> & {
  toolNames: string[];
};
