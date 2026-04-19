import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prismaService.js";

@Global()
@Module({
  exports: [PrismaService],
  providers: [PrismaService],
})
export class PrismaModule {}
