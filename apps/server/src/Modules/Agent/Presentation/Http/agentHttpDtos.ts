import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { AGENT_INTENTS } from "../../Domain/agentTypes.js";
import { AgentImageInputDto } from "../../../../Common/OpenApi/openApiDtos.js";

export class AgentSkillChoiceSubmitRequestDto {
  @ApiProperty({ maxLength: 1000, type: String })
  instruction!: string;

  @ApiProperty({ enum: ["quick", "balanced", "deep"], type: String })
  optionId!: "quick" | "balanced" | "deep";

  @ApiProperty({ maxLength: 4000, type: String })
  originalRequest!: string;

  @ApiProperty({ enum: ["interactive-delivery"], type: String })
  skillId!: "interactive-delivery";
}

export class AgentChoiceIdParamDto {
  @ApiProperty({ format: "uuid", type: String })
  choiceId!: string;
}

export class AgentSkillChoiceSubmitResultDto {
  @ApiProperty({ example: true, type: Boolean })
  accepted!: boolean;

  @ApiProperty({ format: "uuid", type: String })
  choiceId!: string;
}

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
