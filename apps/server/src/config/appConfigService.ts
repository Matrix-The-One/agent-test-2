import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "./env.js";

@Injectable()
export class AppConfigService {
  private static readonly BYTES_PER_MB = 1024 * 1024;

  @Inject(ConfigService)
  private readonly configService!: ConfigService<Env, true>;

  get port() {
    return this.configService.get("PORT", { infer: true });
  }

  get appOrigin() {
    return this.configService.get("APP_ORIGIN", { infer: true });
  }

  get requestBodyLimitBytes() {
    const limitMb = this.configService.get("REQUEST_BODY_LIMIT_MB", {
      infer: true,
    });

    return limitMb * AppConfigService.BYTES_PER_MB;
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

  get providerConfigured() {
    return Boolean(this.openAiApiKey);
  }
}
