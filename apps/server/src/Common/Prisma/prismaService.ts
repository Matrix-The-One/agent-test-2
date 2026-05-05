import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { AppConfigService } from "../../Config/appConfigService.js";
import { PrismaClient } from "../../generated/prisma/client.js";

export type PrismaSession = Pick<
  PrismaClient,
  "conversation" | "message" | "user"
>;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleDestroy, OnModuleInit
{
  private readonly logger = new Logger(PrismaService.name);
  private ready = false;

  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
  ) {
    // Prisma 7 使用 driver adapter；DATABASE_URL 缺失时仍构造 client，但 onModuleInit 不连接。
    const adapter = new PrismaPg({
      connectionString:
        config.databaseUrl ??
        "postgresql://postgres:postgres@localhost:5432/postgres",
    });

    super({ adapter });
  }

  get isReady() {
    return this.ready;
  }

  async onModuleInit() {
    // 本地只看前端或无数据库场景时允许服务启动，但 health 会显示 databaseReady=false。
    if (!this.config.databaseConfigured) {
      this.logger.warn("DATABASE_URL is missing. PostgreSQL persistence is disabled.");
      return;
    }

    await this.$connect();
    this.ready = true;
    this.logger.log("Prisma PostgreSQL connection is ready.");
  }

  async onModuleDestroy() {
    // Nest 进程关闭时释放数据库连接。
    if (!this.ready) {
      return;
    }

    await this.$disconnect();
    this.ready = false;
  }
}
