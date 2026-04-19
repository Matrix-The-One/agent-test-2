import { END } from "@langchain/langgraph";
import { Injectable } from "@nestjs/common";

import type { AgentWorkflowState } from "../agentWorkflowState.js";

@Injectable()
export class AfterIntentEdge {
  next(state: AgentWorkflowState): typeof END | "resolveIntentSkills" {
    return state.intent === "image" ? END : "resolveIntentSkills";
  }
}
