import { Module } from "@nestjs/common";

import { AgentSkillsService } from "./Application/Services/agentSkillsService.js";
import { SkillCatalogController } from "./Presentation/Http/skillCatalogController.js";

@Module({
  controllers: [SkillCatalogController],
  providers: [AgentSkillsService],
  exports: [AgentSkillsService],
})
export class SkillCatalogModule {}
