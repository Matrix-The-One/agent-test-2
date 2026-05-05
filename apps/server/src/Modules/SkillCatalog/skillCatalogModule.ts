import { Module } from "@nestjs/common";

import { AgentSkillsService } from "./Application/Services/agentSkillsService.js";
import { FileCreationService } from "./Infrastructure/Files/fileCreationService.js";
import { DockerScriptRunnerService } from "./Infrastructure/Execution/dockerScriptRunnerService.js";
import { AmapMcpService } from "./Infrastructure/Mcp/amapMcpService.js";
import { SkillCatalogController } from "./Presentation/Http/skillCatalogController.js";

// SkillCatalog 是 Agent 的能力注册中心：本地 tools、文件生成、Docker 执行、外部 MCP 都从这里汇总。
@Module({
  controllers: [SkillCatalogController],
  providers: [
    AgentSkillsService,
    DockerScriptRunnerService,
    FileCreationService,
    AmapMcpService,
  ],
  exports: [AgentSkillsService],
})
export class SkillCatalogModule {}
