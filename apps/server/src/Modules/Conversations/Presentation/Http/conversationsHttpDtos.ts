import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { AGENT_INTENTS } from "../../../Agent/Domain/agentTypes.js";

// 会话 HTTP DTO 只用于 OpenAPI 文档；运行时入参由 conversationSchemas.ts 校验。
export class CreateConversationRequestDto {
  @ApiPropertyOptional({ format: "uuid", type: String })
  id?: string;

  @ApiPropertyOptional({ enum: AGENT_INTENTS, type: String })
  mode?: (typeof AGENT_INTENTS)[number];

  @ApiPropertyOptional({ maxLength: 120, type: String })
  title?: string;

  @ApiProperty({ format: "uuid", type: String })
  userId!: string;
}

export class ConversationListQueryDto {
  @ApiPropertyOptional({ format: "uuid", type: String })
  cursor?: string;

  @ApiPropertyOptional({
    default: 20,
    maximum: 50,
    minimum: 1,
    type: Number,
  })
  limit?: number;

  @ApiPropertyOptional({ maxLength: 120, type: String })
  query?: string;

  @ApiProperty({ format: "uuid", type: String })
  userId!: string;
}

export class ConversationIdParamDto {
  @ApiProperty({ format: "uuid", type: String })
  conversationId!: string;
}

export class ConversationMessagesQueryDto {
  @ApiProperty({ format: "uuid", type: String })
  userId!: string;
}

export class UpdateConversationRequestDto {
  @ApiPropertyOptional({ enum: AGENT_INTENTS, type: String })
  mode?: (typeof AGENT_INTENTS)[number];

  @ApiPropertyOptional({ maxLength: 120, type: String })
  title?: string;

  @ApiProperty({ format: "uuid", type: String })
  userId!: string;
}

export class DeleteConversationResultDto {
  @ApiProperty({ format: "uuid", type: String })
  conversationId!: string;

  @ApiProperty({ type: Boolean })
  deleted!: boolean;
}
