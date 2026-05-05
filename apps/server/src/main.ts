import "reflect-metadata";

import { Logger } from "@nestjs/common";

import { AppConfigService } from "./Config/appConfigService.js";
import { createApp } from "./appFactory.js";

async function bootstrap() {
  // main.ts 只负责启动进程；应用装配细节集中在 appFactory，方便测试和复用。
  const app = await createApp();
  const runtimeConfig = app.get(AppConfigService);
  const logger = new Logger("Bootstrap");

  await app.listen(runtimeConfig.port);
  logger.log(`API ready at http://localhost:${runtimeConfig.port}/api`);
}

void bootstrap();
