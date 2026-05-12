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
import { AgentChoiceService } from "./Application/Services/agentChoiceService.js";
import { AgentGraphFactory } from "./Infrastructure/Factories/agentGraphFactory.js";
import { AgentModelFactory } from "./Infrastructure/Factories/agentModelFactory.js";
import { AgentWorkflowGraphFactory } from "./Infrastructure/Factories/agentWorkflowGraphFactory.js";
import { AfterIntentEdge } from "./Infrastructure/LangGraph/Edges/afterIntentEdge.js";
import { RecognizeIntentNode } from "./Infrastructure/LangGraph/Nodes/recognizeIntentNode.js";
import { ResolveImageRoleNode } from "./Infrastructure/LangGraph/Nodes/resolveImageRoleNode.js";
import { ResolveIntentSkillsNode } from "./Infrastructure/LangGraph/Nodes/resolveIntentSkillsNode.js";
import { AgentController } from "./Presentation/Http/agentController.js";

@Module({
  // Agent 执行需要读取历史会话、持久化消息，并从技能目录中加载可用 specialist/tool。
  imports: [SkillCatalogModule, ConversationsModule],
  controllers: [AgentController],
  providers: [
    // 顶层编排：接收一次对话请求，串起路由、上下文、执行图、流式输出和落库。
    AgentService,
    // 人机选择等待：把前端选择提交映射回当前挂起的 Agent 流。
    AgentChoiceService,
    // 执行图工厂：WorkflowGraph 负责前置路由，AgentGraph 负责真正的多 Agent 执行。
    AgentGraphFactory,
    AgentWorkflowGraphFactory,
    // 模型与上下文基础设施：集中选择模型、估算 token、压缩长对话。
    AgentModelFactory,
    AgentModelCatalogService,
    AgentTokenCountService,
    AgentContextWindowService,
    // 路由服务：先识别图片角色，再判断用户意图，最后映射到技能集合。
    AgentImageRoleService,
    AgentIntentService,
    AgentIntentSkillService,
    // LangGraph 节点和条件边：保持节点逻辑可单独测试和替换。
    ResolveImageRoleNode,
    RecognizeIntentNode,
    ResolveIntentSkillsNode,
    AfterIntentEdge,
  ],
})
export class AgentModule {}
