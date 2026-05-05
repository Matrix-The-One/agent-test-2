import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const openApiConfig = new DocumentBuilder()
  .setTitle("Agent API")
  .setDescription("OpenAPI contract for the Agent workspace backend.")
  .setVersion("1.0.0")
  .build();

// OpenAPI 导出和 Swagger 文档复用这个工厂，operationId 固定为方法名，方便 Orval 生成前端客户端。
export const buildOpenApiDocument = (app: NestFastifyApplication) =>
  SwaggerModule.createDocument(app, openApiConfig, {
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
