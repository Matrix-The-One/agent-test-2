import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppConfigModule } from "./Config/appConfigModule.js";
import { validateEnv } from "./Config/env.js";
import { AgentModule } from "./Modules/Agent/agentModule.js";
import { HealthModule } from "./Modules/Health/healthModule.js";
import { SkillCatalogModule } from "./Modules/SkillCatalog/skillCatalogModule.js";

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
