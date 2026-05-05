import { END, START, StateGraph } from "@langchain/langgraph";
import { Inject, Injectable } from "@nestjs/common";

import { agentWorkflowStateSchema } from "../LangGraph/agentWorkflowState.js";
import { AfterIntentEdge } from "../LangGraph/Edges/afterIntentEdge.js";
import { RecognizeIntentNode } from "../LangGraph/Nodes/recognizeIntentNode.js";
import { ResolveImageRoleNode } from "../LangGraph/Nodes/resolveImageRoleNode.js";
import { ResolveIntentSkillsNode } from "../LangGraph/Nodes/resolveIntentSkillsNode.js";

// 第一层 LangGraph：只做前置路由，不生成最终回答。
// 顺序是 图片角色 -> 顶层意图 -> 技能选择；image 意图会提前 END。
const buildAgentWorkflowGraph = (
  resolveImageRoleNode: ResolveImageRoleNode,
  recognizeIntentNode: RecognizeIntentNode,
  resolveIntentSkillsNode: ResolveIntentSkillsNode,
  afterIntentEdge: AfterIntentEdge,
) =>
  new StateGraph(agentWorkflowStateSchema)
    // 节点只返回局部 state patch，LangGraph 会合并回完整 workflow state。
    .addNode("resolveImageRole", (state, config) =>
      resolveImageRoleNode.run(state, config),
    )
    .addNode("recognizeIntent", (state, config) =>
      recognizeIntentNode.run(state, config),
    )
    .addNode("resolveIntentSkills", (state, config) =>
      resolveIntentSkillsNode.run(state, config),
    )
    .addEdge(START, "resolveImageRole")
    .addEdge("resolveImageRole", "recognizeIntent")
    // image 目前没有真实图片模型，路由到 END 后由 AgentService 返回占位说明。
    .addConditionalEdges(
      "recognizeIntent",
      (state) => afterIntentEdge.next(state),
      ["resolveIntentSkills", END],
    )
    .addEdge("resolveIntentSkills", END)
    .compile();

type AgentWorkflowGraph = ReturnType<typeof buildAgentWorkflowGraph>;

@Injectable()
export class AgentWorkflowGraphFactory {
  @Inject(ResolveImageRoleNode)
  private readonly resolveImageRoleNode!: ResolveImageRoleNode;

  @Inject(RecognizeIntentNode)
  private readonly recognizeIntentNode!: RecognizeIntentNode;

  @Inject(ResolveIntentSkillsNode)
  private readonly resolveIntentSkillsNode!: ResolveIntentSkillsNode;

  @Inject(AfterIntentEdge)
  private readonly afterIntentEdge!: AfterIntentEdge;

  private graph?: AgentWorkflowGraph;

  createGraph() {
    // 路由图没有请求级可变状态，可以在 Factory 内缓存编译结果。
    this.graph ??= buildAgentWorkflowGraph(
      this.resolveImageRoleNode,
      this.recognizeIntentNode,
      this.resolveIntentSkillsNode,
      this.afterIntentEdge,
    );

    return this.graph;
  }
}
