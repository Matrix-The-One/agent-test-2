import { Injectable } from "@nestjs/common";

import { createCodeEngineeringSkill } from "../../skills/code-engineering.skill.js";
import { createContentCreationSkill } from "../../skills/content-creation.skill.js";
import { createDeliveryPlanningSkill } from "../../skills/delivery-planning.skill.js";
import { createDocumentProductionSkill } from "../../skills/document-production.skill.js";
import { createProjectContextSkill } from "../../skills/project-context.skill.js";
import { createQualityGuardSkill } from "../../skills/quality-guard.skill.js";
import { createSolutionArchitectureSkill } from "../../skills/solution-architecture.skill.js";
import {
  AGENT_SKILL_IDS,
  MAX_ROUTED_AGENT_SKILLS,
  type AgentSkillDefinition,
  type AgentSkillId,
  type PublicAgentSkill,
} from "../../domain/agent-skill.types.js";

const containsAny = (message: string, keywords: readonly string[]) =>
  keywords.some((keyword) => message.includes(keyword));

@Injectable()
export class AgentSkillsService {
  private readonly skills: AgentSkillDefinition[] = [
    createProjectContextSkill(),
    createSolutionArchitectureSkill(),
    createDeliveryPlanningSkill(),
    createQualityGuardSkill(),
    createContentCreationSkill(),
    createCodeEngineeringSkill(),
    createDocumentProductionSkill(),
  ];

  private readonly skillMap = new Map(
    this.skills.map((skill) => [skill.id, skill] as const),
  );

  getAllSkills() {
    return [...this.skills];
  }

  getPublicCatalog(): PublicAgentSkill[] {
    return this.skills.map(({ routingHints, tools, ...skill }) => ({
      ...skill,
      toolNames: tools.map((tool) => tool.name),
    }));
  }

  getSkillsByIds(skillIds: readonly AgentSkillId[]) {
    return skillIds
      .map((skillId) => this.skillMap.get(skillId))
      .filter((skill): skill is AgentSkillDefinition => Boolean(skill));
  }

  normalizeSkillIds(skillIds: readonly string[]) {
    const deduped = Array.from(new Set(skillIds));

    return deduped
      .filter((skillId): skillId is AgentSkillId =>
        AGENT_SKILL_IDS.includes(skillId as AgentSkillId),
      )
      .slice(0, MAX_ROUTED_AGENT_SKILLS);
  }

  getRoutingCatalog() {
    return this.skills
      .map((skill) =>
        [
          `技能 ID：${skill.id}`,
          `技能名称：${skill.name}`,
          `技能分类：${skill.categoryLabel}`,
          `技能热度：${skill.popularity}`,
          `技能描述：${skill.description}`,
          `适用场景：${skill.useCases.join("；")}`,
          `标签：${skill.tags.join("、")}`,
          `函数列表：${skill.tools.map((tool) => tool.name).join("、")}`,
        ].join("\n"),
      )
      .join("\n\n");
  }

  getFallbackSkillIds(message: string) {
    const normalizedMessage = message.toLowerCase();
    const matchedSkillIds = this.skills
      .filter((skill) => containsAny(normalizedMessage, skill.routingHints))
      .map((skill) => skill.id);

    if (matchedSkillIds.length > 0) {
      return this.normalizeSkillIds(matchedSkillIds);
    }

    return ["solution-architecture"] as AgentSkillId[];
  }
}
