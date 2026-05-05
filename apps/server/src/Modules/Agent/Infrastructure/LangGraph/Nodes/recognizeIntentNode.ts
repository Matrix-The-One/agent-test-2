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
    // 读取上游 resolveImageRole 写入的 hasImages/imageRole，再判断顶层意图。
    const decision = await this.intentService.recognize({
      hasImages: state.hasImages,
      imageRole: state.imageRole,
      message: state.message,
      requestedMode: state.requestedMode,
      signal: config?.signal,
    });

    return {
      // 返回局部 patch，LangGraph 会把它合并进 workflow state。
      intent: decision.intent,
      intentReason: decision.reason,
    };
  }
}
