import { Body, Controller, Inject, Post, Res } from "@nestjs/common";
import { pipeUIMessageStreamToResponse } from "ai";
import type { FastifyReply } from "fastify";

import { ZodValidationPipe } from "../../../../Common/Pipes/zodValidationPipe.js";
import {
  agentChatRequestSchema,
  type AgentChatRequest,
} from "../../Domain/agentSchemas.js";
import { AgentService } from "../../Application/Services/agentService.js";

@Controller("agent")
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
  async streamAgentReply(
    @Body(new ZodValidationPipe(agentChatRequestSchema)) body: AgentChatRequest,
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
