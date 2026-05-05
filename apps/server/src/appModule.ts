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

// AppModule 是服务端模块树根节点。
// 阅读 Nest 项目时可以从这里看“有哪些功能模块”和“全局基础设施从哪里接入”。
@Module({
  imports: [
    // ConfigModule 只负责把 process.env 交给 validateEnv 校验；env 文件加载发生在 Config/env.ts。
    ConfigModule.forRoot({
      cache: true,
      ignoreEnvFile: true,
      isGlobal: true,
      validate: validateEnv,
    }),
    AppConfigModule,
    PrismaModule,
    // 业务模块按依赖顺序注册：基础健康检查、用户、会话、技能目录、Agent 编排。
    HealthModule,
    UsersModule,
    ConversationsModule,
    SkillCatalogModule,
    AgentModule,
  ],
})
export class AppModule {}
