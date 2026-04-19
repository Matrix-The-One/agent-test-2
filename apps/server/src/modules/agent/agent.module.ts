import { Module } from "@nestjs/common";

import { SkillCatalogModule } from "../skill-catalog/skill-catalog.module.js";
import { AgentClarificationService } from "./application/services/agent-clarification.service.js";
import { AgentIntentService } from "./application/services/agent-intent.service.js";
import { AgentSkillRouterService } from "./application/services/agent-skill-router.service.js";
import { AgentService } from "./application/services/agent.service.js";
import { AgentGraphFactory } from "./infrastructure/factories/agent-graph.factory.js";
import { AgentModelFactory } from "./infrastructure/factories/agent-model.factory.js";
import { AgentWorkflowGraphFactory } from "./infrastructure/factories/agent-workflow-graph.factory.js";
import { AfterClarificationEdge } from "./infrastructure/langgraph/edges/after-clarification.edge.js";
import { AfterIntentEdge } from "./infrastructure/langgraph/edges/after-intent.edge.js";
import { EvaluateClarificationNode } from "./infrastructure/langgraph/nodes/evaluate-clarification.node.js";
import { RecognizeIntentNode } from "./infrastructure/langgraph/nodes/recognize-intent.node.js";
import { RouteSkillsNode } from "./infrastructure/langgraph/nodes/route-skills.node.js";
import { AgentController } from "./presentation/http/agent.controller.js";

@Module({
  imports: [SkillCatalogModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentGraphFactory,
    AgentWorkflowGraphFactory,
    AgentModelFactory,
    AgentClarificationService,
    AgentIntentService,
    AgentSkillRouterService,
    EvaluateClarificationNode,
    RecognizeIntentNode,
    RouteSkillsNode,
    AfterClarificationEdge,
    AfterIntentEdge,
  ],
})
export class AgentModule {}
