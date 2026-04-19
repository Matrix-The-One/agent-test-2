import { MemorySaver } from "@langchain/langgraph";
import { Inject, Injectable } from "@nestjs/common";
import { createAgent } from "langchain";

import type { AgentSkillDefinition } from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import { AgentModelFactory } from "./agentModelFactory.js";

const buildAgentGraph = (
  modelFactory: AgentModelFactory,
  skills: AgentSkillDefinition[],
  checkpointer: MemorySaver,
) =>
  createAgent({
    checkpointer,
    model: modelFactory.createChatModel(),
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
