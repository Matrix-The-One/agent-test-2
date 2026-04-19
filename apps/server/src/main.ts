import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import { AppConfigService } from "./config/app-config.service.js";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false,
  });

  const config = app.get(AppConfigService);
  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: config.appOrigin,
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(config.port);
  logger.log(`API ready at http://localhost:${config.port}/api`);
}

void bootstrap();
