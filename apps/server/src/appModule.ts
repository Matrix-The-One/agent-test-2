import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { PrismaModule } from "./Common/Prisma/prismaModule.js";
import { AppConfigModule } from "./Config/appConfigModule.js";
import { validateEnv } from "./Config/env.js";
import { AgentModule } from "./Modules/Agent/agentModule.js";
import { ConversationsModule } from "./Modules/Conversations/conversationsModule.js";
import { HealthModule } from "./Modules/Health/healthModule.js";
import { SkillCatalogModule } from "./Modules/SkillCatalog/skillCatalogModule.js";
import { UsersModule } from "./Modules/Users/usersModule.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      ignoreEnvFile: true,
      isGlobal: true,
      validate: validateEnv,
    }),
    AppConfigModule,
    PrismaModule,
    HealthModule,
    UsersModule,
    ConversationsModule,
    SkillCatalogModule,
    AgentModule,
  ],
})
export class AppModule {}
