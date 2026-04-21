import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { SkillCatalogDto } from "../../../../Common/OpenApi/openApiDtos.js";
import { ApiEnvelopeResponse } from "../../../../Common/OpenApi/openApiResponse.js";
import { AgentSkillsService } from "../../Application/Services/agentSkillsService.js";

@Controller("agent/skills")
@ApiTags("agent-skills")
export class SkillCatalogController {
  @Inject(AgentSkillsService)
  private readonly skillsService!: AgentSkillsService;

  @Get()
  @ApiEnvelopeResponse(SkillCatalogDto)
  async getCatalog() {
    const skills = await this.skillsService.getPublicCatalog();

    return {
      popularSkillIds: skills
        .filter((skill) => skill.popularity === "popular")
        .map((skill) => skill.id),
      skills,
      total: skills.length,
    };
  }
}
