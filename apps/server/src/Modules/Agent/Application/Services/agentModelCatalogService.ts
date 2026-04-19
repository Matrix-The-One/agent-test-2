import { Inject, Injectable } from "@nestjs/common";

import type { AgentSkillCategory } from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import { resolveAgentModelSpec } from "../../Domain/agentModelCatalog.js";
import type { AgentIntent } from "../../Domain/agentTypes.js";
import { AgentModelFactory } from "../../Infrastructure/Factories/agentModelFactory.js";

@Injectable()
export class AgentModelCatalogService {
  constructor(
    @Inject(AgentModelFactory)
    private readonly modelFactory: AgentModelFactory,
  ) {}

  getSpec(model: string) {
    return resolveAgentModelSpec(model);
  }

  resolveConversationBudget(input: {
    intent: AgentIntent;
    specialistCategories: readonly AgentSkillCategory[];
  }) {
    const candidateModels = this.modelFactory.getExecutionModelNames(input);
    const specs = candidateModels.map((model) => this.getSpec(model));
    const primarySpec = specs.reduce((current, next) =>
      next.contextWindowTokens < current.contextWindowTokens ? next : current,
    );
    const reservedOutputTokens = Math.min(
      primarySpec.maxOutputTokens,
      Math.max(8_192, Math.floor(primarySpec.contextWindowTokens * 0.15)),
    );
    const reservedInstructionTokens = Math.min(
      48_000,
      4_000 + input.specialistCategories.length * 2_000,
    );
    const maxConversationTokens = Math.max(
      8_192,
      primarySpec.contextWindowTokens
        - reservedOutputTokens
        - reservedInstructionTokens,
    );

    return {
      maxConversationTokens,
      model: primarySpec.model,
      reservedInstructionTokens,
      reservedOutputTokens,
      spec: primarySpec,
    };
  }
}
