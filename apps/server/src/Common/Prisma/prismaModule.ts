import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prismaService.js";

// Prisma 是全局基础设施，Repository 可以直接注入 PrismaService，不需要每个模块重复 imports。
@Global()
@Module({
  exports: [PrismaService],
  providers: [PrismaService],
})
export class PrismaModule {}
