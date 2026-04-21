import { Inject, Injectable } from "@nestjs/common";

import { AgentIntentService } from "../../../Application/Services/agentIntentService.js";
import type { AgentWorkflowState } from "../agentWorkflowState.js";

@Injectable()
export class RecognizeIntentNode {
  @Inject(AgentIntentService)
  private readonly intentService!: AgentIntentService;

  async run(
    state: AgentWorkflowState,
    config?: {
      signal?: AbortSignal;
    },
  ) {
    const decision = await this.intentService.recognize({
      hasImages: state.hasImages,
      imageRole: state.imageRole,
      message: state.message,
      requestedMode: state.requestedMode,
      signal: config?.signal,
    });

    return {
      intent: decision.intent,
      intentReason: decision.reason,
    };
  }
}
