import { Inject, Injectable } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";

import { AppConfigService } from "../../../../Config/appConfigService.js";
import type { AgentSkillCategory } from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import type { AgentIntent } from "../../Domain/agentTypes.js";

@Injectable()
export class AgentModelFactory {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  createSupervisorModel() {
    // supervisor 负责调度和最终整合，温度低一些以保持稳定。
    return this.createModel(this.getSupervisorModelName(), {
      temperature: 0.2,
    });
  }

  createIntentModel() {
    // 意图识别必须稳定可复现，禁用重试并使用 0 温度。
    return this.createModel(this.getIntentModelName(), {
      maxRetries: 0,
      temperature: 0,
    });
  }

  createSpecialistModel(category: AgentSkillCategory) {
    // 不同 specialist 的创造性需求不同，例如 content 可以更发散，quality 更保守。
    return this.createModel(this.getSpecialistModelName(category), {
      temperature: this.getSpecialistTemperature(category),
    });
  }

  createCompactionModel() {
    // 上下文摘要要稳定保留事实，不追求创造性。
    return this.createModel(this.getCompactionModelName(), {
      maxRetries: 0,
      temperature: 0.1,
    });
  }

  getIntentModelName() {
    return this.config.agentIntentModel;
  }

  getSupervisorModelName() {
    return this.config.agentSupervisorModel;
  }

  getCompactionModelName() {
    return this.getSupervisorModelName();
  }

  getSpecialistModelName(category: AgentSkillCategory) {
    // 每类 specialist 可以单独配置模型，方便按成本/能力做角色分层。
    switch (category) {
      case "project":
        return this.config.agentProjectModel;
      case "location":
        return this.config.agentLocationModel;
      case "artifact":
        return this.config.agentArtifactModel;
      case "content":
        return this.config.agentContentModel;
      case "document":
        return this.config.agentDocumentModel;
      case "engineering":
        return this.config.agentEngineeringModel;
      case "architecture":
        return this.config.agentArchitectureModel;
      case "delivery":
        return this.config.agentDeliveryModel;
      case "quality":
        return this.config.agentQualityModel;
    }
  }

  getExecutionModelNames(input: {
    intent: AgentIntent;
    specialistCategories: readonly AgentSkillCategory[];
  }) {
    // 给上下文预算服务使用：找出本轮可能参与执行的所有模型。
    const names = new Set<string>([this.getSupervisorModelName()]);

    for (const category of input.specialistCategories) {
      names.add(this.getSpecialistModelName(category));
    }

    if (input.intent === "image") {
      names.add(this.getIntentModelName());
    }

    return Array.from(names);
  }

  private getSpecialistTemperature(category: AgentSkillCategory) {
    // 温度按任务性质分层：事实/工具型低温，内容创作稍高。
    switch (category) {
      case "project":
      case "location":
        return 0.1;
      case "artifact":
        return 0.1;
      case "content":
        return 0.6;
      case "document":
        return 0.4;
      case "engineering":
      case "architecture":
      case "delivery":
        return 0.2;
      case "quality":
        return 0.1;
    }
  }

  private createModel(
    model: string,
    options?: {
      maxRetries?: number;
      temperature?: number;
    },
  ) {
    // 项目通过 OpenAI 兼容接口接入模型；OPENAI_BASE_URL 可指向代理或兼容服务。
    return new ChatOpenAI({
      apiKey: this.config.openAiApiKey,
      configuration: this.config.openAiBaseUrl
        ? { baseURL: this.config.openAiBaseUrl }
        : undefined,
      maxRetries: options?.maxRetries,
      model,
      temperature: options?.temperature,
    });
  }
}
