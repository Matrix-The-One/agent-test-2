import { applyDecorators, type Type } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from "@nestjs/swagger";

type OpenApiSchema = Record<string, unknown>;

// Swagger 中展示的错误响应 DTO，对应 HttpExceptionFilter 输出的 envelope。
export class ApiErrorResponseDto {
  @ApiProperty({ example: false, type: Boolean })
  success!: false;

  @ApiProperty({
    additionalProperties: true,
    example: null,
    nullable: true,
    type: "object",
  })
  data!: null;

  @ApiProperty({ example: "Request failed", type: String })
  errorMsg!: string;

  @ApiPropertyOptional({ example: "BAD_REQUEST", nullable: true, type: String })
  errorCode?: string | null;

  @ApiPropertyOptional({
    additionalProperties: true,
    nullable: true,
    type: "object",
  })
  errors?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: "/api/conversations", type: String })
  path?: string;

  @ApiPropertyOptional({ example: 400, type: Number })
  statusCode?: number;

  @ApiPropertyOptional({ example: "2026-04-20T00:00:00.000Z", type: String })
  timestamp?: string;
}

const buildEnvelopeSchema = (dataSchema: OpenApiSchema): OpenApiSchema => ({
  // 普通 API 实际返回 { success, data, errorMsg, ... }，这里手写 schema 保持文档一致。
  properties: {
    data: {
      ...dataSchema,
      nullable: true,
    },
    errorCode: {
      example: null,
      nullable: true,
      type: "string",
    },
    errorMsg: {
      example: "",
      type: "string",
    },
    errors: {
      additionalProperties: true,
      nullable: true,
      type: "object",
    },
    success: {
      example: true,
      type: "boolean",
    },
  },
  required: ["success", "data", "errorMsg"],
  type: "object",
});

const buildDataSchema = (
  model: Type<unknown>,
  options?: {
    isArray?: boolean;
  },
): OpenApiSchema =>
  options?.isArray
    ? {
        items: {
          $ref: getSchemaPath(model),
        },
        type: "array",
      }
    : {
        $ref: getSchemaPath(model),
      };

export const ApiEnvelopeResponse = (
  model: Type<unknown>,
  options?: {
    description?: string;
    extraModels?: Type<unknown>[];
    isArray?: boolean;
    status?: 200 | 201;
  },
) => {
  // 给 Controller 方法一键挂上成功响应和常见错误响应，减少每个接口重复写 Swagger decorator。
  const responseDecorator =
    options?.status === 201 ? ApiCreatedResponse : ApiOkResponse;

  return applyDecorators(
    ApiExtraModels(model, ApiErrorResponseDto, ...(options?.extraModels ?? [])),
    responseDecorator({
      description: options?.description,
      schema: buildEnvelopeSchema(buildDataSchema(model, options)),
    }),
    ApiBadRequestResponse({ type: ApiErrorResponseDto }),
    ApiNotFoundResponse({ type: ApiErrorResponseDto }),
    ApiInternalServerErrorResponse({ type: ApiErrorResponseDto }),
  );
};
