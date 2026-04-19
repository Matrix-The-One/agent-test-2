import { Controller, Get, Inject } from "@nestjs/common";

import { AgentSkillsService } from "../../application/services/agent-skills.service.js";

@Controller("agent/skills")
export class SkillCatalogController {
  @Inject(AgentSkillsService)
  private readonly skillsService!: AgentSkillsService;

  @Get()
  getCatalog() {
    const skills = this.skillsService.getPublicCatalog();

    return {
      popularSkillIds: skills
        .filter((skill) => skill.popularity === "popular")
        .map((skill) => skill.id),
      skills,
      total: skills.length,
    };
  }
}
