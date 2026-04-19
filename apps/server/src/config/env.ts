import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const emptyStringAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

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
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  REQUEST_BODY_LIMIT_MB: z.coerce.number().int().positive().default(30),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENAI_BASE_URL: z.preprocess(
    emptyStringAsUndefined,
    z.string().url().optional(),
  ),
  OPENAI_API_KEY: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) =>
  envSchema.parse(config);
