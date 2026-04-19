import { NestFactory, HttpAdapterHost, Reflector } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { HttpExceptionFilter } from "./Common/Filters/httpExceptionFilter.js";
import { ApiResponseInterceptor } from "./Common/Interceptors/apiResponseInterceptor.js";
import { AppConfigService } from "./Config/appConfigService.js";
import { validateEnv } from "./Config/env.js";
import { AppModule } from "./appModule.js";

export const createApp = async (options?: {
  logger?: false;
}) => {
  const env = validateEnv(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: env.REQUEST_BODY_LIMIT_MB * 1024 * 1024,
    }),
    {
      cors: false,
      ...(options?.logger === false ? { logger: false } : {}),
    },
  );

  const runtimeConfig = app.get(AppConfigService);
  const { httpAdapter } = app.get(HttpAdapterHost);
  const reflector = app.get(Reflector);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: runtimeConfig.appOrigin,
  });
  app.useGlobalFilters(new HttpExceptionFilter(httpAdapter));
  app.useGlobalInterceptors(new ApiResponseInterceptor(reflector));

  return app;
};
