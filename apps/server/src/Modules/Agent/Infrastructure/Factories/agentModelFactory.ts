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
    return this.createModel(this.getSupervisorModelName(), {
      temperature: 0.2,
    });
  }

  createIntentModel() {
    return this.createModel(this.getIntentModelName(), {
      maxRetries: 0,
      temperature: 0,
    });
  }

  createSpecialistModel(category: AgentSkillCategory) {
    return this.createModel(this.getSpecialistModelName(category), {
      temperature: this.getSpecialistTemperature(category),
    });
  }

  createCompactionModel() {
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
    switch (category) {
      case "project":
        return this.config.agentProjectModel;
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
    switch (category) {
      case "project":
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
