import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const emptyStringAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalModelSchema = () =>
  z.preprocess(emptyStringAsUndefined, z.string().min(1).optional());

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
  AGENT_INTENT_MODEL: optionalModelSchema(),
  AGENT_SUPERVISOR_MODEL: optionalModelSchema(),
  AGENT_PROJECT_MODEL: optionalModelSchema(),
  AGENT_CONTENT_MODEL: optionalModelSchema(),
  AGENT_DOCUMENT_MODEL: optionalModelSchema(),
  AGENT_ENGINEERING_MODEL: optionalModelSchema(),
  AGENT_ARCHITECTURE_MODEL: optionalModelSchema(),
  AGENT_DELIVERY_MODEL: optionalModelSchema(),
  AGENT_QUALITY_MODEL: optionalModelSchema(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) =>
  envSchema.parse(config);
