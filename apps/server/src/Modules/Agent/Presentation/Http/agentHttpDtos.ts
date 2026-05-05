import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { AGENT_INTENTS } from "../../Domain/agentTypes.js";
import { AgentImageInputDto } from "../../../../Common/OpenApi/openApiDtos.js";

// 这个 DTO 只用于 Swagger/OpenAPI；实际运行时校验使用 agentChatRequestSchema。
export class AgentChatRequestDto {
  @ApiProperty({
    default: [],
    isArray: true,
    maxItems: 4,
    type: AgentImageInputDto,
  })
  images!: AgentImageInputDto[];

  @ApiProperty({
    default: "",
    maxLength: 4000,
    type: String,
  })
  message!: string;

  @ApiPropertyOptional({ enum: AGENT_INTENTS, type: String })
  mode?: (typeof AGENT_INTENTS)[number];

  @ApiPropertyOptional({ format: "uuid", type: String })
  threadId?: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  userId?: string;
}
