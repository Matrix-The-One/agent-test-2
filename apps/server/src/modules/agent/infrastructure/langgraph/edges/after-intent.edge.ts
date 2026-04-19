import { END } from "@langchain/langgraph";
import { Injectable } from "@nestjs/common";

import type { AgentWorkflowState } from "../agent-workflow.state.js";

@Injectable()
export class AfterIntentEdge {
  next(state: AgentWorkflowState): typeof END | "routeSkills" {
    return state.intent === "skill-routing" ? "routeSkills" : END;
  }
}

