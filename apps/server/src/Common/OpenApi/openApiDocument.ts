import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const openApiConfig = new DocumentBuilder()
  .setTitle("Agent API")
  .setDescription("OpenAPI contract for the Agent workspace backend.")
  .setVersion("1.0.0")
  .build();

export const buildOpenApiDocument = (app: NestFastifyApplication) =>
  SwaggerModule.createDocument(app, openApiConfig, {
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
