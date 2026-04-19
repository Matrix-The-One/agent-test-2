import { Injectable } from "@nestjs/common";

import { createCodeEngineeringSkill } from "../../Skills/codeEngineeringSkill.js";
import { createContentCreationSkill } from "../../Skills/contentCreationSkill.js";
import { createDeliveryPlanningSkill } from "../../Skills/deliveryPlanningSkill.js";
import { createDocumentProductionSkill } from "../../Skills/documentProductionSkill.js";
import { createProjectContextSkill } from "../../Skills/projectContextSkill.js";
import { createQualityGuardSkill } from "../../Skills/qualityGuardSkill.js";
import { createSolutionArchitectureSkill } from "../../Skills/solutionArchitectureSkill.js";
import {
  type AgentSkillDefinition,
  type AgentSkillId,
  type PublicAgentSkill,
} from "../../Domain/agentSkillTypes.js";

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
}
