import { Body, Controller, Inject, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { pipeUIMessageStreamToResponse } from "ai";
import type { FastifyReply } from "fastify";

import { RawResponse } from "../../../../Common/Decorators/rawResponse.js";
import { ZodValidationPipe } from "../../../../Common/Pipes/zodValidationPipe.js";
import {
  agentChatRequestSchema,
} from "../../Domain/agentSchemas.js";
import { AgentService } from "../../Application/Services/agentService.js";
import { AgentChatRequestDto } from "./agentHttpDtos.js";

@Controller("agent")
@ApiTags("agent")
export class AgentController {
  @Inject(AgentService)
  private readonly agentService!: AgentService;

  private writeError(reply: FastifyReply, error: unknown) {
    const message = this.agentService.normalizeError(error);

    if (reply.raw.headersSent || reply.raw.writableEnded) {
      if (!reply.raw.writableEnded) {
        reply.raw.end(message);
      }

      return;
    }

    reply
      .code(500)
      .header("Content-Type", "text/plain; charset=utf-8")
      .send(message);
  }

  @Post("stream")
  @RawResponse()
  @ApiConsumes("application/json")
  @ApiProduces("text/event-stream")
  @ApiBody({ type: AgentChatRequestDto })
  @ApiOkResponse({
    content: {
      "text/event-stream": {
        schema: {
          type: "string",
        },
      },
    },
    description: "AI SDK UI message stream.",
  })
  async streamAgentReply(
    @Body(new ZodValidationPipe(agentChatRequestSchema)) body: AgentChatRequestDto,
    @Res() reply: FastifyReply,
  ) {
    try {
      const stream = await this.agentService.streamReply(body);
      reply.hijack();

      pipeUIMessageStreamToResponse({
        headers: {
          "Cache-Control": "no-cache, no-transform",
        },
        response: reply.raw,
        stream,
      });
    } catch (error) {
      this.writeError(reply, error);
    }
  }
}
