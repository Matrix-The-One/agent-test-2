import { Inject, Injectable } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";

import { AppConfigService } from "../../../../Config/appConfigService.js";

@Injectable()
export class AgentModelFactory {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  createChatModel() {
    return this.createModel(this.config.openAiModel);
  }

  createIntentModel() {
    return this.createModel(this.config.openAiModel, {
      maxRetries: 0,
      temperature: 0,
    });
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
