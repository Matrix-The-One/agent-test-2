import { Inject, Injectable } from "@nestjs/common";

import { AgentClarificationService } from "../../../application/services/agent-clarification.service.js";
import type { AgentWorkflowState } from "../agent-workflow.state.js";

@Injectable()
export class EvaluateClarificationNode {
  @Inject(AgentClarificationService)
  private readonly clarificationService!: AgentClarificationService;

  async run(state: AgentWorkflowState) {
    return {
      clarification: await this.clarificationService.evaluate(state.message),
    };
  }
}

