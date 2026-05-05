import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiBody, ApiParam, ApiTags } from "@nestjs/swagger";

import { ApiEnvelopeResponse } from "../../../../Common/OpenApi/openApiResponse.js";
import { UserRecordDto } from "../../../../Common/OpenApi/openApiDtos.js";
import { ZodValidationPipe } from "../../../../Common/Pipes/zodValidationPipe.js";
import {
  ensureUserRequestSchema,
  userIdParamSchema,
} from "../../Domain/userSchemas.js";
import { UserService } from "../../Application/Services/userService.js";
import { EnsureUserRequestDto, UserIdParamDto } from "./usersHttpDtos.js";

@Controller("users")
@ApiTags("users")
export class UsersController {
  constructor(
    @Inject(UserService)
    private readonly userService: UserService,
  ) {}

  @Post("ensure")
  @ApiBody({ type: EnsureUserRequestDto })
  @ApiEnvelopeResponse(UserRecordDto, { status: 201 })
  ensureUser(
    @Body(new ZodValidationPipe(ensureUserRequestSchema))
    body: EnsureUserRequestDto,
  ) {
    // 前端用这个接口创建或刷新本地用户记录。
    return this.userService.ensureUser(body);
  }

  @Get(":userId")
  @ApiParam({ name: "userId", schema: { format: "uuid", type: "string" } })
  @ApiEnvelopeResponse(UserRecordDto)
  getUser(
    @Param(new ZodValidationPipe(userIdParamSchema))
    params: UserIdParamDto,
  ) {
    // 会话页面可用它确认当前 userId 是否存在。
    return this.userService.getUserById(params.userId);
  }
}
