import { Inject, Injectable } from "@nestjs/common";

import { AgentImageRoleService } from "../../../Application/Services/agentImageRoleService.js";
import type { AgentWorkflowState } from "../agentWorkflowState.js";

@Injectable()
export class ResolveImageRoleNode {
  @Inject(AgentImageRoleService)
  private readonly imageRoleService!: AgentImageRoleService;

  async run(
    state: AgentWorkflowState,
    _config?: {
      signal?: AbortSignal;
    },
  ) {
    const decision = this.imageRoleService.detect({
      images: state.images,
      message: state.message,
    });

    return {
      hasImages: decision.hasImages,
      imageRole: decision.role,
      imageRoleReason: decision.reason,
    };
  }
}
