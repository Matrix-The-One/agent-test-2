import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const emptyStringAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const serverEnvFilePath = resolve(process.cwd(), ".env");

const dotenvResult = loadDotenv({
  path: serverEnvFilePath,
});

if (
  dotenvResult.error &&
  (dotenvResult.error as NodeJS.ErrnoException).code !== "ENOENT"
) {
  throw dotenvResult.error;
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENAI_ROUTER_MODEL: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).optional(),
  ),
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
