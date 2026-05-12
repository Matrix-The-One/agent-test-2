import { Inject, Injectable } from "@nestjs/common";

import { createAmapMapsSkill } from "../../Skills/amapMapsSkill.js";
import { createCodeEngineeringSkill } from "../../Skills/codeEngineeringSkill.js";
import { createContentCreationSkill } from "../../Skills/contentCreationSkill.js";
import { createDataProcessingSkill } from "../../Skills/dataProcessingSkill.js";
import { createDeliveryPlanningSkill } from "../../Skills/deliveryPlanningSkill.js";
import { createDocumentProductionSkill } from "../../Skills/documentProductionSkill.js";
import { createFileCreationSkill } from "../../Skills/fileCreationSkill.js";
import { createInteractiveDeliverySkill } from "../../Skills/interactiveDeliverySkill.js";
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
    // 公共目录给前端展示，只暴露 toolNames，不暴露 routingHints 和真实 tool 对象。
    const skills = await this.getSkills();

    return skills.map(({ routingHints, tools, ...skill }) => ({
      ...skill,
      toolNames: tools.map((tool) => tool.name),
    }));
  }

  async getSkillsByIds(skillIds: readonly AgentSkillId[]) {
    // AgentIntentSkillService 只返回 skillIds；AgentService 在这里解析成完整定义。
    const skillMap = await this.getSkillMap();

    return skillIds
      .map((skillId) => skillMap.get(skillId))
      .filter((skill): skill is AgentSkillDefinition => Boolean(skill));
  }

  private async getSkills() {
    // skills 可能包含远程 MCP tools，初始化后缓存，避免每次请求重复拉取。
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
    // 本地 skills 是固定注册表；外部 MCP skill 按配置动态追加。
    const skills: AgentSkillDefinition[] = [
      createProjectContextSkill(),
      createWorkspaceInspectionSkill(this.dockerScriptRunner),
      createSolutionArchitectureSkill(),
      createDeliveryPlanningSkill(),
      createInteractiveDeliverySkill(),
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
      // AMap MCP 可用时才把位置 specialist 纳入目录和路由候选。
      skills.push(createAmapMapsSkill(amapTools));
    }

    return skills;
  }

  private async loadSkillMap() {
    // Map 方便按 id 快速解析路由结果。
    return new Map(
      (await this.getSkills()).map((skill) => [skill.id, skill] as const),
    );
  }
}
