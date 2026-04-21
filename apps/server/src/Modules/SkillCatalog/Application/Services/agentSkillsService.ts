import { Inject, Injectable } from "@nestjs/common";

import { createAmapMapsSkill } from "../../Skills/amapMapsSkill.js";
import { createCodeEngineeringSkill } from "../../Skills/codeEngineeringSkill.js";
import { createContentCreationSkill } from "../../Skills/contentCreationSkill.js";
import { createDataProcessingSkill } from "../../Skills/dataProcessingSkill.js";
import { createDeliveryPlanningSkill } from "../../Skills/deliveryPlanningSkill.js";
import { createDocumentProductionSkill } from "../../Skills/documentProductionSkill.js";
import { createFileCreationSkill } from "../../Skills/fileCreationSkill.js";
import { createProjectContextSkill } from "../../Skills/projectContextSkill.js";
import { createQualityGuardSkill } from "../../Skills/qualityGuardSkill.js";
import { createRuntimeVerificationSkill } from "../../Skills/runtimeVerificationSkill.js";
import { createSolutionArchitectureSkill } from "../../Skills/solutionArchitectureSkill.js";
import { createWorkspaceInspectionSkill } from "../../Skills/workspaceInspectionSkill.js";
import {
  type AgentSkillDefinition,
  type AgentSkillId,
  type PublicAgentSkill,
} from "../../Domain/agentSkillTypes.js";
import { DockerScriptRunnerService } from "../../Infrastructure/Execution/dockerScriptRunnerService.js";
import { FileCreationService } from "../../Infrastructure/Files/fileCreationService.js";
import { AmapMcpService } from "../../Infrastructure/Mcp/amapMcpService.js";

@Injectable()
export class AgentSkillsService {
  @Inject(DockerScriptRunnerService)
  private readonly dockerScriptRunner!: DockerScriptRunnerService;

  @Inject(FileCreationService)
  private readonly fileCreationService!: FileCreationService;

  @Inject(AmapMcpService)
  private readonly amapMcpService!: AmapMcpService;

  private skillsCache?: Promise<AgentSkillDefinition[]>;
  private skillMapCache?: Promise<Map<AgentSkillId, AgentSkillDefinition>>;

  async getPublicCatalog(): Promise<PublicAgentSkill[]> {
    const skills = await this.getSkills();

    return skills.map(({ routingHints, tools, ...skill }) => ({
      ...skill,
      toolNames: tools.map((tool) => tool.name),
    }));
  }

  async getSkillsByIds(skillIds: readonly AgentSkillId[]) {
    const skillMap = await this.getSkillMap();

    return skillIds
      .map((skillId) => skillMap.get(skillId))
      .filter((skill): skill is AgentSkillDefinition => Boolean(skill));
  }

  private async getSkills() {
    if (!this.skillsCache) {
      this.skillsCache = this.loadSkills();
    }

    return await this.skillsCache;
  }

  private async getSkillMap() {
    if (!this.skillMapCache) {
      this.skillMapCache = this.loadSkillMap();
    }

    return await this.skillMapCache;
  }

  private async loadSkills() {
    const skills: AgentSkillDefinition[] = [
      createProjectContextSkill(),
      createWorkspaceInspectionSkill(this.dockerScriptRunner),
      createSolutionArchitectureSkill(),
      createDeliveryPlanningSkill(),
      createQualityGuardSkill(),
      createContentCreationSkill(),
      createFileCreationSkill(this.fileCreationService),
      createCodeEngineeringSkill(this.dockerScriptRunner),
      createRuntimeVerificationSkill(this.dockerScriptRunner),
      createDataProcessingSkill(this.dockerScriptRunner),
      createDocumentProductionSkill(),
    ];
    const amapTools = await this.amapMcpService.getTools();

    if (amapTools.length > 0) {
      skills.push(createAmapMapsSkill(amapTools));
    }

    return skills;
  }

  private async loadSkillMap() {
    return new Map(
      (await this.getSkills()).map((skill) => [skill.id, skill] as const),
    );
  }
}
