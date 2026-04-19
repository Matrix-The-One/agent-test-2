import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "./env.js";

@Injectable()
export class AppConfigService {
  @Inject(ConfigService)
  private readonly configService!: ConfigService<Env, true>;

  get port() {
    return this.configService.get("PORT", { infer: true });
  }

  get appOrigin() {
    return this.configService.get("APP_ORIGIN", { infer: true });
  }

  get openAiApiKey() {
    return this.configService.get("OPENAI_API_KEY", { infer: true }) ?? undefined;
  }

  get openAiBaseUrl() {
    return this.configService.get("OPENAI_BASE_URL", { infer: true }) ?? undefined;
  }

  get openAiModel() {
    const model = this.configService.get("OPENAI_MODEL", { infer: true });

    return model.startsWith("openai:") ? model.slice("openai:".length) : model;
  }

  get openAiRouterModel() {
    const model = this.configService.get("OPENAI_ROUTER_MODEL", {
      infer: true,
    });

    if (!model) {
      return this.openAiModel;
    }

    return model.startsWith("openai:") ? model.slice("openai:".length) : model;
  }

  get providerConfigured() {
    return Boolean(this.openAiApiKey);
  }
}
