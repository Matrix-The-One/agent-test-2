import { Module } from "@nestjs/common";

import { ConversationsModule } from "../Conversations/conversationsModule.js";
import { SkillCatalogModule } from "../SkillCatalog/skillCatalogModule.js";
import { AgentImageRoleService } from "./Application/Services/agentImageRoleService.js";
import { AgentIntentService } from "./Application/Services/agentIntentService.js";
import { AgentIntentSkillService } from "./Application/Services/agentIntentSkillService.js";
import { AgentModelCatalogService } from "./Application/Services/agentModelCatalogService.js";
import { AgentService } from "./Application/Services/agentService.js";
import { AgentTokenCountService } from "./Application/Services/agentTokenCountService.js";
import { AgentContextWindowService } from "./Application/Services/agentContextWindowService.js";
import { AgentGraphFactory } from "./Infrastructure/Factories/agentGraphFactory.js";
import { AgentModelFactory } from "./Infrastructure/Factories/agentModelFactory.js";
import { AgentWorkflowGraphFactory } from "./Infrastructure/Factories/agentWorkflowGraphFactory.js";
import { AfterIntentEdge } from "./Infrastructure/LangGraph/Edges/afterIntentEdge.js";
import { RecognizeIntentNode } from "./Infrastructure/LangGraph/Nodes/recognizeIntentNode.js";
import { ResolveImageRoleNode } from "./Infrastructure/LangGraph/Nodes/resolveImageRoleNode.js";
import { ResolveIntentSkillsNode } from "./Infrastructure/LangGraph/Nodes/resolveIntentSkillsNode.js";
import { AgentController } from "./Presentation/Http/agentController.js";

@Module({
  imports: [SkillCatalogModule, ConversationsModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentGraphFactory,
    AgentWorkflowGraphFactory,
    AgentModelFactory,
    AgentImageRoleService,
    AgentIntentService,
    AgentIntentSkillService,
    AgentModelCatalogService,
    AgentTokenCountService,
    AgentContextWindowService,
    ResolveImageRoleNode,
    RecognizeIntentNode,
    ResolveIntentSkillsNode,
    AfterIntentEdge,
  ],
})
export class AgentModule {}
