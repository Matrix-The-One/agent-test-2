import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolve } from "node:path";

import type { Env } from "./env.js";

@Injectable()
export class AppConfigService {
  private static readonly BYTES_PER_MB = 1024 * 1024;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<Env, true>,
  ) {}

  get port() {
    return this.configService.get("PORT", { infer: true });
  }

  get appOrigin() {
    return this.configService.get("APP_ORIGIN", { infer: true });
  }

  get databaseUrl() {
    return this.configService.get("DATABASE_URL", { infer: true }) ?? undefined;
  }

  get databaseConfigured() {
    return Boolean(this.databaseUrl);
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

  get openAiTokenCountApiKey() {
    return (
      this.configService.get("OPENAI_TOKEN_COUNT_API_KEY", { infer: true })
      ?? this.openAiApiKey
    );
  }

  get openAiTokenCountBaseUrl() {
    return (
      this.configService.get("OPENAI_TOKEN_COUNT_BASE_URL", { infer: true })
      ?? this.openAiBaseUrl
    );
  }

  get amapMapsApiKey() {
    return this.configService.get("AMAP_MAPS_API_KEY", { infer: true }) ?? undefined;
  }

  get amapMapsMcpEnabled() {
    return this.configService.get("AGENT_MCP_AMAP_ENABLED", { infer: true });
  }

  get amapMapsMcpBaseUrl() {
    return this.configService.get("AGENT_MCP_AMAP_BASE_URL", { infer: true });
  }

  get amapMapsMcpTimeoutMs() {
    return this.configService.get("AGENT_MCP_AMAP_TIMEOUT_MS", { infer: true });
  }

  get amapMapsMcpConfigured() {
    return this.amapMapsMcpEnabled && Boolean(this.amapMapsApiKey);
  }

  get openAiModel() {
    const model = this.configService.get("OPENAI_MODEL", { infer: true });

    return this.normalizeModelName(model);
  }

  get dockerEnabled() {
    return this.configService.get("DOCKER_ENABLED", { infer: true });
  }

  get dockerBin() {
    return this.configService.get("DOCKER_BIN", { infer: true });
  }

  get agentDockerJavaScriptImage() {
    return this.configService.get("AGENT_DOCKER_JS_IMAGE", { infer: true });
  }

  get agentDockerPythonImage() {
    return this.configService.get("AGENT_DOCKER_PY_IMAGE", { infer: true });
  }

  get agentDockerTimeoutMs() {
    return this.configService.get("AGENT_DOCKER_TIMEOUT_MS", { infer: true });
  }

  get agentDockerMaxOutputChars() {
    return this.configService.get("AGENT_DOCKER_MAX_OUTPUT_CHARS", {
      infer: true,
    });
  }

  get agentDockerWorkspaceRoot() {
    const configuredRoot = this.configService.get("AGENT_DOCKER_WORKSPACE_ROOT", {
      infer: true,
    });

    return resolve(configuredRoot ?? resolve(process.cwd(), "..", ".."));
  }

  get agentFileOutputRoot() {
    const configuredRoot = this.configService.get("AGENT_FILE_OUTPUT_ROOT", {
      infer: true,
    });

    return resolve(configuredRoot ?? this.agentDockerWorkspaceRoot);
  }

  get agentIntentModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_INTENT_MODEL") ?? "gpt-5.4-mini",
    );
  }

  get agentSupervisorModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_SUPERVISOR_MODEL") ?? "gpt-5.4-mini",
    );
  }

  get agentProjectModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_PROJECT_MODEL") ?? this.agentSupervisorModel,
    );
  }

  get agentLocationModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_LOCATION_MODEL") ?? this.agentProjectModel,
    );
  }

  get agentContentModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_CONTENT_MODEL") ?? "gpt-5.4",
    );
  }

  get agentDocumentModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_DOCUMENT_MODEL") ?? this.agentContentModel,
    );
  }

  get agentArtifactModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_ARTIFACT_MODEL") ?? this.agentEngineeringModel,
    );
  }

  get agentEngineeringModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_ENGINEERING_MODEL") ?? "gpt-5.3-codex",
    );
  }

  get agentArchitectureModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_ARCHITECTURE_MODEL") ?? "gpt-5.4",
    );
  }

  get agentDeliveryModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_DELIVERY_MODEL") ?? "gpt-5.2",
    );
  }

  get agentQualityModel() {
    return this.normalizeModelName(
      this.getOptionalModel("AGENT_QUALITY_MODEL") ?? "claude-sonnet-4-6",
    );
  }

  get providerConfigured() {
    return Boolean(this.openAiApiKey);
  }

  get dockerConfigured() {
    return this.dockerEnabled;
  }

  get tokenCountProviderConfigured() {
    return Boolean(this.openAiTokenCountApiKey);
  }

  private getOptionalModel(
    key:
      | "AGENT_INTENT_MODEL"
      | "AGENT_SUPERVISOR_MODEL"
      | "AGENT_PROJECT_MODEL"
      | "AGENT_LOCATION_MODEL"
      | "AGENT_CONTENT_MODEL"
      | "AGENT_DOCUMENT_MODEL"
      | "AGENT_ARTIFACT_MODEL"
      | "AGENT_ENGINEERING_MODEL"
      | "AGENT_ARCHITECTURE_MODEL"
      | "AGENT_DELIVERY_MODEL"
      | "AGENT_QUALITY_MODEL",
  ) {
    const model = this.configService.get(key, { infer: true });

    return typeof model === "string" ? model : undefined;
  }

  private normalizeModelName(model: string) {
    return model.startsWith("openai:") ? model.slice("openai:".length) : model;
  }
}
