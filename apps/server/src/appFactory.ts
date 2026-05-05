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
  // 在创建 Nest 应用前先校验环境变量，避免服务启动后才暴露配置错误。
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

  // 所有业务接口统一挂在 /api 下，前端 Vite 代理也按这个前缀转发。
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: runtimeConfig.appOrigin,
  });

  // 普通 HTTP 接口走统一错误和响应包裹；SSE 等原始响应接口会通过元数据跳过包裹。
  app.useGlobalFilters(new HttpExceptionFilter(httpAdapter));
  app.useGlobalInterceptors(new ApiResponseInterceptor(reflector));

  return app;
};
