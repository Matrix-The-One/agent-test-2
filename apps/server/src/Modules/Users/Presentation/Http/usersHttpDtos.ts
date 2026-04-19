import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EnsureUserRequestDto {
  @ApiProperty({ default: "Local User", maxLength: 120, type: String })
  displayName!: string;

  @ApiPropertyOptional({ format: "email", type: String })
  email?: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  id?: string;
}

export class UserIdParamDto {
  @ApiProperty({ format: "uuid", type: String })
  userId!: string;
}
