import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory, HttpAdapterHost } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { HttpExceptionFilter } from "./Common/Filters/httpExceptionFilter.js";
import { AppConfigService } from "./Config/appConfigService.js";
import { validateEnv } from "./Config/env.js";
import { AppModule } from "./appModule.js";

async function bootstrap() {
  const env = validateEnv(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: env.REQUEST_BODY_LIMIT_MB * 1024 * 1024,
    }),
    {
      cors: false,
    },
  );

  const runtimeConfig = app.get(AppConfigService);
  const { httpAdapter } = app.get(HttpAdapterHost);
  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: runtimeConfig.appOrigin,
  });
  app.useGlobalFilters(new HttpExceptionFilter(httpAdapter));

  await app.listen(runtimeConfig.port);
  logger.log(`API ready at http://localhost:${runtimeConfig.port}/api`);
}

void bootstrap();
