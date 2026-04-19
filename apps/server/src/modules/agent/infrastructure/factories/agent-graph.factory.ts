import { MemorySaver } from "@langchain/langgraph";
import { Inject, Injectable } from "@nestjs/common";
import { createAgent } from "langchain";

import { buildAgentSystemPrompt } from "../../domain/agent.constants.js";
import type { AgentSkillDefinition } from "../../../skill-catalog/domain/agent-skill.types.js";
import { AgentModelFactory } from "./agent-model.factory.js";

const buildAgentGraph = (
  modelFactory: AgentModelFactory,
  skills: AgentSkillDefinition[],
  checkpointer: MemorySaver,
) =>
  createAgent({
    checkpointer,
    model: modelFactory.createChatModel(),
    systemPrompt: buildAgentSystemPrompt(skills),
    tools: skills.flatMap((skill) => skill.tools),
  });

type AgentGraph = ReturnType<typeof buildAgentGraph>;

@Injectable()
export class AgentGraphFactory {
  private readonly checkpointer = new MemorySaver();

  @Inject(AgentModelFactory)
  private readonly modelFactory!: AgentModelFactory;

  createGraph(skills: AgentSkillDefinition[]): AgentGraph {
    return buildAgentGraph(this.modelFactory, skills, this.checkpointer);
  }
}
