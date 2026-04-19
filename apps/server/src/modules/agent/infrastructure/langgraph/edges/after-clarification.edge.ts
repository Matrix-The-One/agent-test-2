import { END } from "@langchain/langgraph";
import { Injectable } from "@nestjs/common";

import type { AgentWorkflowState } from "../agent-workflow.state.js";

@Injectable()
export class AfterClarificationEdge {
  next(state: AgentWorkflowState): typeof END | "recognizeIntent" {
    return state.clarification.needClarification ? END : "recognizeIntent";
  }
}

