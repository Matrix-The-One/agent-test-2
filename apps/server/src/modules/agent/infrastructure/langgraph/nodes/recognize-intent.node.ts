import { Inject, Injectable } from "@nestjs/common";

import { AgentIntentService } from "../../../application/services/agent-intent.service.js";
import type { AgentWorkflowState } from "../agent-workflow.state.js";

@Injectable()
export class RecognizeIntentNode {
  @Inject(AgentIntentService)
  private readonly intentService!: AgentIntentService;

  async run(state: AgentWorkflowState) {
    const decision = await this.intentService.recognize(state.message);

    return {
      intent: decision.intent,
      intentReason: decision.reason,
    };
  }
}

