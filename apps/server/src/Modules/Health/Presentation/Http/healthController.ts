import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { HealthStatusDto } from "../../../../Common/OpenApi/openApiDtos.js";
import { ApiEnvelopeResponse } from "../../../../Common/OpenApi/openApiResponse.js";
import { PrismaService } from "../../../../Common/Prisma/prismaService.js";
import { AppConfigService } from "../../../../Config/appConfigService.js";

@Controller("health")
@ApiTags("health")
export class HealthController {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  @Inject(PrismaService)
  private readonly prismaService!: PrismaService;

  @Get()
  @ApiEnvelopeResponse(HealthStatusDto)
  getHealth() {
    // health 不主动查询数据库，只返回 PrismaService 当前连接状态和关键配置是否存在。
    return {
      databaseConfigured: this.config.databaseConfigured,
      databaseReady: this.prismaService.isReady,
      memoryEnabled: true,
      model: this.config.openAiModel,
      providerConfigured: this.config.providerConfigured,
      status: "ok",
    };
  }
}
