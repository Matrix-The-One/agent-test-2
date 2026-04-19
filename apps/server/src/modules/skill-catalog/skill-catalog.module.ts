import { Module } from "@nestjs/common";

import { AgentSkillsService } from "./application/services/agent-skills.service.js";
import { SkillCatalogController } from "./presentation/http/skill-catalog.controller.js";

@Module({
  controllers: [SkillCatalogController],
  providers: [AgentSkillsService],
  exports: [AgentSkillsService],
})
export class SkillCatalogModule {}
