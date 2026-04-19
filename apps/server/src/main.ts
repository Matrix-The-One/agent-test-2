import "reflect-metadata";

import { Logger } from "@nestjs/common";

import { AppConfigService } from "./Config/appConfigService.js";
import { createApp } from "./appFactory.js";

async function bootstrap() {
  const app = await createApp();
  const runtimeConfig = app.get(AppConfigService);
  const logger = new Logger("Bootstrap");

  await app.listen(runtimeConfig.port);
  logger.log(`API ready at http://localhost:${runtimeConfig.port}/api`);
}

void bootstrap();
