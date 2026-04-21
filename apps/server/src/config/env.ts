import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const emptyStringAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const parseBooleanish = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return value;
};

const optionalModelSchema = () =>
  z.preprocess(emptyStringAsUndefined, z.string().min(1).optional());

const booleanishSchema = () => z.preprocess(parseBooleanish, z.boolean());

const loadOptionalEnvFile = (path: string) => {
  const dotenvResult = loadDotenv({
    path,
  });

  if (
    dotenvResult.error &&
    (dotenvResult.error as NodeJS.ErrnoException).code !== "ENOENT"
  ) {
    throw dotenvResult.error;
  }
};

export const serverAgentEnvFilePath = resolve(process.cwd(), ".env.agent");
export const serverEnvFilePath = resolve(process.cwd(), ".env");

// Load the more specific agent env first; .env fills the remaining app defaults.
for (const envFilePath of [
  serverAgentEnvFilePath,
  serverEnvFilePath,
]) {
  loadOptionalEnvFile(envFilePath);
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  DATABASE_URL: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).optional(),
  ),
  REQUEST_BODY_LIMIT_MB: z.coerce.number().int().positive().default(30),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  OPENAI_BASE_URL: z.preprocess(
    emptyStringAsUndefined,
    z.url().optional(),
  ),
  OPENAI_API_KEY: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).optional(),
  ),
  OPENAI_TOKEN_COUNT_BASE_URL: z.preprocess(
    emptyStringAsUndefined,
    z.url().optional(),
  ),
  OPENAI_TOKEN_COUNT_API_KEY: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).optional(),
  ),
  AGENT_MCP_AMAP_ENABLED: booleanishSchema().default(false),
  AMAP_MAPS_API_KEY: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).optional(),
  ),
  AGENT_MCP_AMAP_BASE_URL: z.preprocess(
    emptyStringAsUndefined,
    z.url().default("https://mcp.amap.com/mcp"),
  ),
  AGENT_MCP_AMAP_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  DOCKER_ENABLED: booleanishSchema().default(false),
  DOCKER_BIN: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).default("docker"),
  ),
  AGENT_DOCKER_JS_IMAGE: z.string().min(1).default("node:22-bookworm-slim"),
  AGENT_DOCKER_PY_IMAGE: z.string().min(1).default("python:3.12-slim"),
  AGENT_DOCKER_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  AGENT_DOCKER_MAX_OUTPUT_CHARS: z.coerce
    .number()
    .int()
    .positive()
    .default(12000),
  AGENT_DOCKER_WORKSPACE_ROOT: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).optional(),
  ),
  AGENT_FILE_OUTPUT_ROOT: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).optional(),
  ),
  AGENT_INTENT_MODEL: optionalModelSchema(),
  AGENT_SUPERVISOR_MODEL: optionalModelSchema(),
  AGENT_PROJECT_MODEL: optionalModelSchema(),
  AGENT_LOCATION_MODEL: optionalModelSchema(),
  AGENT_CONTENT_MODEL: optionalModelSchema(),
  AGENT_DOCUMENT_MODEL: optionalModelSchema(),
  AGENT_ARTIFACT_MODEL: optionalModelSchema(),
  AGENT_ENGINEERING_MODEL: optionalModelSchema(),
  AGENT_ARCHITECTURE_MODEL: optionalModelSchema(),
  AGENT_DELIVERY_MODEL: optionalModelSchema(),
  AGENT_QUALITY_MODEL: optionalModelSchema(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) =>
  envSchema.parse(config);
