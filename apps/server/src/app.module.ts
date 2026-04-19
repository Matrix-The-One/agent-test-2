import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppConfigModule } from "./config/app-config.module.js";
import { validateEnv } from "./config/env.js";
import { AgentModule } from "./modules/agent/agent.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { SkillCatalogModule } from "./modules/skill-catalog/skill-catalog.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      ignoreEnvFile: true,
      isGlobal: true,
      validate: validateEnv,
    }),
    AppConfigModule,
    HealthModule,
    SkillCatalogModule,
    AgentModule,
  ],
})
export class AppModule {}
