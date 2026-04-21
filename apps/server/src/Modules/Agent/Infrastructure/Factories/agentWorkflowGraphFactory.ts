import { END, START, StateGraph } from "@langchain/langgraph";
import { Inject, Injectable } from "@nestjs/common";

import { agentWorkflowStateSchema } from "../LangGraph/agentWorkflowState.js";
import { AfterIntentEdge } from "../LangGraph/Edges/afterIntentEdge.js";
import { RecognizeIntentNode } from "../LangGraph/Nodes/recognizeIntentNode.js";
import { ResolveImageRoleNode } from "../LangGraph/Nodes/resolveImageRoleNode.js";
import { ResolveIntentSkillsNode } from "../LangGraph/Nodes/resolveIntentSkillsNode.js";

const buildAgentWorkflowGraph = (
  resolveImageRoleNode: ResolveImageRoleNode,
  recognizeIntentNode: RecognizeIntentNode,
  resolveIntentSkillsNode: ResolveIntentSkillsNode,
  afterIntentEdge: AfterIntentEdge,
) =>
  new StateGraph(agentWorkflowStateSchema)
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
    this.graph ??= buildAgentWorkflowGraph(
      this.resolveImageRoleNode,
      this.recognizeIntentNode,
      this.resolveIntentSkillsNode,
      this.afterIntentEdge,
    );

    return this.graph;
  }
}
