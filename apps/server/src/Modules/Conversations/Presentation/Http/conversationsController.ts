import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { ApiEnvelopeResponse } from "../../../../Common/OpenApi/openApiResponse.js";
import {
  ConversationListResultDto,
  ConversationMessageRecordDto,
  ConversationRecordDto,
} from "../../../../Common/OpenApi/openApiDtos.js";
import { ZodValidationPipe } from "../../../../Common/Pipes/zodValidationPipe.js";
import { ConversationService } from "../../Application/Services/conversationService.js";
import {
  conversationIdParamSchema,
  conversationListQuerySchema,
  conversationMessagesQuerySchema,
  createConversationRequestSchema,
  updateConversationRequestSchema,
} from "../../Domain/conversationSchemas.js";
import {
  ConversationIdParamDto,
  ConversationListQueryDto,
  ConversationMessagesQueryDto,
  CreateConversationRequestDto,
  DeleteConversationResultDto,
  UpdateConversationRequestDto,
} from "./conversationsHttpDtos.js";

@Controller("conversations")
@ApiTags("conversations")
export class ConversationsController {
  constructor(
    @Inject(ConversationService)
    private readonly conversationService: ConversationService,
  ) {}

  @Get()
  @ApiQuery({ name: "userId", required: true, schema: { format: "uuid", type: "string" } })
  @ApiQuery({ name: "cursor", required: false, schema: { format: "uuid", type: "string" } })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { default: 20, maximum: 50, minimum: 1, type: "number" },
  })
  @ApiQuery({ name: "query", required: false, schema: { maxLength: 120, type: "string" } })
  @ApiEnvelopeResponse(ConversationListResultDto)
  listConversations(
    @Query(new ZodValidationPipe(conversationListQuerySchema))
    query: ConversationListQueryDto,
  ) {
    return this.conversationService.listConversations(query.userId, {
      cursor: query.cursor,
      limit: query.limit,
      query: query.query,
    });
  }

  @Post()
  @ApiBody({ type: CreateConversationRequestDto })
  @ApiEnvelopeResponse(ConversationRecordDto, { status: 201 })
  createConversation(
    @Body(new ZodValidationPipe(createConversationRequestSchema))
    body: CreateConversationRequestDto,
  ) {
    return this.conversationService.createConversation(body);
  }

  @Patch(":conversationId")
  @ApiParam({ name: "conversationId", schema: { format: "uuid", type: "string" } })
  @ApiBody({ type: UpdateConversationRequestDto })
  @ApiEnvelopeResponse(ConversationRecordDto)
  updateConversation(
    @Param(new ZodValidationPipe(conversationIdParamSchema))
    params: ConversationIdParamDto,
    @Body(new ZodValidationPipe(updateConversationRequestSchema))
    body: UpdateConversationRequestDto,
  ) {
    return this.conversationService.updateConversation({
      conversationId: params.conversationId,
      mode: body.mode,
      title: body.title,
      userId: body.userId,
    });
  }

  @Get(":conversationId/messages")
  @ApiParam({ name: "conversationId", schema: { format: "uuid", type: "string" } })
  @ApiQuery({ name: "userId", required: true, schema: { format: "uuid", type: "string" } })
  @ApiEnvelopeResponse(ConversationMessageRecordDto, { isArray: true })
  getConversationMessages(
    @Param(new ZodValidationPipe(conversationIdParamSchema))
    params: ConversationIdParamDto,
    @Query(new ZodValidationPipe(conversationMessagesQuerySchema))
    query: ConversationMessagesQueryDto,
  ) {
    return this.conversationService.getConversationMessages(
      query.userId,
      params.conversationId,
    );
  }

  @Delete(":conversationId")
  @ApiParam({ name: "conversationId", schema: { format: "uuid", type: "string" } })
  @ApiQuery({ name: "userId", required: true, schema: { format: "uuid", type: "string" } })
  @ApiEnvelopeResponse(DeleteConversationResultDto)
  deleteConversation(
    @Param(new ZodValidationPipe(conversationIdParamSchema))
    params: ConversationIdParamDto,
    @Query(new ZodValidationPipe(conversationMessagesQuerySchema))
    query: ConversationMessagesQueryDto,
  ) {
    return this.conversationService.deleteConversation(
      query.userId,
      params.conversationId,
    );
  }
}
