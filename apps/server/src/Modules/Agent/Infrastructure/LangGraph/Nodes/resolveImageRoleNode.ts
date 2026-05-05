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
    // 第一层 workflow 的第一个节点：只看原始 message/images，判断图片角色。
    const decision = this.imageRoleService.detect({
      images: state.images,
      message: state.message,
    });

    return {
      // 这些字段会影响后续 recognizeIntent 的判断。
      hasImages: decision.hasImages,
      imageRole: decision.role,
      imageRoleReason: decision.reason,
    };
  }
}
