import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { defineConfig, env } from "prisma/config";

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

for (const envFilePath of [
  resolve(process.cwd(), ".env.agent"),
  resolve(process.cwd(), ".env"),
]) {
  loadOptionalEnvFile(envFilePath);
}

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
});
