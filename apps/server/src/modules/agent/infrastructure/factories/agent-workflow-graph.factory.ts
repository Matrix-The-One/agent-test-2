import { END, START, StateGraph } from "@langchain/langgraph";
import { Inject, Injectable } from "@nestjs/common";

import { agentWorkflowStateSchema } from "../langgraph/agent-workflow.state.js";
import { AfterClarificationEdge } from "../langgraph/edges/after-clarification.edge.js";
import { AfterIntentEdge } from "../langgraph/edges/after-intent.edge.js";
import { EvaluateClarificationNode } from "../langgraph/nodes/evaluate-clarification.node.js";
import { RecognizeIntentNode } from "../langgraph/nodes/recognize-intent.node.js";
import { RouteSkillsNode } from "../langgraph/nodes/route-skills.node.js";

const buildAgentWorkflowGraph = (
  evaluateClarificationNode: EvaluateClarificationNode,
  recognizeIntentNode: RecognizeIntentNode,
  routeSkillsNode: RouteSkillsNode,
  afterClarificationEdge: AfterClarificationEdge,
  afterIntentEdge: AfterIntentEdge,
) =>
  new StateGraph(agentWorkflowStateSchema)
    .addNode("evaluateClarification", (state) =>
      evaluateClarificationNode.run(state),
    )
    .addNode("recognizeIntent", (state) => recognizeIntentNode.run(state))
    .addNode("routeSkills", (state) => routeSkillsNode.run(state))
    .addEdge(START, "evaluateClarification")
    .addConditionalEdges(
      "evaluateClarification",
      (state) => afterClarificationEdge.next(state),
      ["recognizeIntent", END],
    )
    .addConditionalEdges(
      "recognizeIntent",
      (state) => afterIntentEdge.next(state),
      ["routeSkills", END],
    )
    .addEdge("routeSkills", END)
    .compile();

type AgentWorkflowGraph = ReturnType<typeof buildAgentWorkflowGraph>;

@Injectable()
export class AgentWorkflowGraphFactory {
  @Inject(EvaluateClarificationNode)
  private readonly evaluateClarificationNode!: EvaluateClarificationNode;

  @Inject(RecognizeIntentNode)
  private readonly recognizeIntentNode!: RecognizeIntentNode;

  @Inject(RouteSkillsNode)
  private readonly routeSkillsNode!: RouteSkillsNode;

  @Inject(AfterClarificationEdge)
  private readonly afterClarificationEdge!: AfterClarificationEdge;

  @Inject(AfterIntentEdge)
  private readonly afterIntentEdge!: AfterIntentEdge;

  private graph?: AgentWorkflowGraph;

  createGraph() {
    this.graph ??= buildAgentWorkflowGraph(
      this.evaluateClarificationNode,
      this.recognizeIntentNode,
      this.routeSkillsNode,
      this.afterClarificationEdge,
      this.afterIntentEdge,
    );

    return this.graph;
  }
}

