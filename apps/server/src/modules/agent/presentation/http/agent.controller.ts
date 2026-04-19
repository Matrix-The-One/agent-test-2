import { Body, Controller, Inject, Post, Res } from "@nestjs/common";
import { pipeUIMessageStreamToResponse } from "ai";

import type { Response } from "express";

import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import {
  agentChatRequestSchema,
  type AgentChatRequest,
} from "../../domain/agent.schemas.js";
import { AgentService } from "../../application/services/agent.service.js";

@Controller("agent")
export class AgentController {
  @Inject(AgentService)
  private readonly agentService!: AgentService;

  @Post("stream")
  async streamAgentReply(
    @Body(new ZodValidationPipe(agentChatRequestSchema)) body: AgentChatRequest,
    @Res() response: Response,
  ) {
    try {
      const stream = await this.agentService.streamReply(body);

      pipeUIMessageStreamToResponse({
        headers: {
          "Cache-Control": "no-cache, no-transform",
        },
        response,
        stream,
      });
    } catch (error) {
      response
        .status(500)
        .contentType("text/plain; charset=utf-8")
        .send(this.agentService.normalizeError(error));
    }
  }
}
