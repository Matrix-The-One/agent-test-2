import { Inject, Injectable } from "@nestjs/common";

import { AgentIntentSkillService } from "../../../Application/Services/agentIntentSkillService.js";
import type { AgentWorkflowState } from "../agentWorkflowState.js";

@Injectable()
export class ResolveIntentSkillsNode {
  @Inject(AgentIntentSkillService)
  private readonly intentSkillService!: AgentIntentSkillService;

  async run(
    state: AgentWorkflowState,
    _config?: {
      signal?: AbortSignal;
    },
  ) {
    // 根据已经识别出的 intent/imageRole 选择后续第二层 Agent 图要加载的 skills。
    return {
      skillSelection: this.intentSkillService.resolve({
        hasImages: state.hasImages,
        imageRole: state.imageRole,
        intent: state.intent,
        message: state.message,
      }),
    };
  }
}
