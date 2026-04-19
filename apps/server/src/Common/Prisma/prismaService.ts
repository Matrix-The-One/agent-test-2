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
    if (!this.config.databaseConfigured) {
      this.logger.warn("DATABASE_URL is missing. PostgreSQL persistence is disabled.");
      return;
    }

    await this.$connect();
    this.ready = true;
    this.logger.log("Prisma PostgreSQL connection is ready.");
  }

  async onModuleDestroy() {
    if (!this.ready) {
      return;
    }

    await this.$disconnect();
    this.ready = false;
  }
}
