import { Module } from "@nestjs/common";

import { AgentSkillsService } from "./Application/Services/agentSkillsService.js";
import { FileCreationService } from "./Infrastructure/Files/fileCreationService.js";
import { DockerScriptRunnerService } from "./Infrastructure/Execution/dockerScriptRunnerService.js";
import { AmapMcpService } from "./Infrastructure/Mcp/amapMcpService.js";
import { SkillCatalogController } from "./Presentation/Http/skillCatalogController.js";

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
