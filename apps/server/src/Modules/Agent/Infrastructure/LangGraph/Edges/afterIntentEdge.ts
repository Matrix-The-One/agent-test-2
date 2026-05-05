import { END } from "@langchain/langgraph";
import { Injectable } from "@nestjs/common";

import type { AgentWorkflowState } from "../agentWorkflowState.js";

@Injectable()
export class AfterIntentEdge {
  next(state: AgentWorkflowState): typeof END | "resolveIntentSkills" {
    // image 意图当前不需要文本 skill 路由，直接结束第一层 workflow。
    return state.intent === "image" ? END : "resolveIntentSkills";
  }
}
