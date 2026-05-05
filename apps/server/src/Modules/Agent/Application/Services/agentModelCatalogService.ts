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
    // 根据模型名取上下文窗口/最大输出规格；未知模型使用保守 fallback。
    return resolveAgentModelSpec(model);
  }

  resolveConversationBudget(input: {
    intent: AgentIntent;
    specialistCategories: readonly AgentSkillCategory[];
  }) {
    // 一次执行可能使用 supervisor + 多个 specialist 模型；上下文预算按最小窗口模型计算。
    const candidateModels = this.modelFactory.getExecutionModelNames(input);
    const specs = candidateModels.map((model) => this.getSpec(model));
    const primarySpec = specs.reduce((current, next) =>
      next.contextWindowTokens < current.contextWindowTokens ? next : current,
    );
    // 输出 token 和系统/工具指令都要预留，剩下的才给历史对话。
    const reservedOutputTokens = Math.min(
      primarySpec.maxOutputTokens,
      Math.max(8_192, Math.floor(primarySpec.contextWindowTokens * 0.15)),
    );
    const reservedInstructionTokens = Math.min(
      48_000,
      4_000 + input.specialistCategories.length * 2_000,
    );
    const maxConversationTokens = Math.max(
      // 至少保留 8k 给对话历史，避免小窗口或异常规格下预算过低。
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
