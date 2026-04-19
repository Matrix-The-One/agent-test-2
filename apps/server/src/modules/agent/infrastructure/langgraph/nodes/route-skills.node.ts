import { Inject, Injectable } from "@nestjs/common";

import { AgentSkillRouterService } from "../../../application/services/agent-skill-router.service.js";
import type { AgentWorkflowState } from "../agent-workflow.state.js";

@Injectable()
export class RouteSkillsNode {
  @Inject(AgentSkillRouterService)
  private readonly skillRouter!: AgentSkillRouterService;

  async run(state: AgentWorkflowState) {
    const selection = await this.skillRouter.matchSkills(state.message);

    return {
      skillSelection: {
        reason: selection.reason,
        skillIds: selection.skillIds,
      },
    };
  }
}

