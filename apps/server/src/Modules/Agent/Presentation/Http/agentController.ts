import { Body, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { pipeUIMessageStreamToResponse } from "ai";
import type { FastifyReply, FastifyRequest } from "fastify";

import { RawResponse } from "../../../../Common/Decorators/rawResponse.js";
import { ZodValidationPipe } from "../../../../Common/Pipes/zodValidationPipe.js";
import {
  agentChatRequestSchema,
} from "../../Domain/agentSchemas.js";
import { createAbortError } from "../../Domain/agentAbort.js";
import { AgentService } from "../../Application/Services/agentService.js";
import { AgentChatRequestDto } from "./agentHttpDtos.js";

const AGENT_SSE_HEARTBEAT_INTERVAL_MS = 15_000;

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
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const abortController = new AbortController();
    let heartbeatHandle: NodeJS.Timeout | undefined;
    let responseFinished = false;

    const clearHeartbeat = () => {
      if (!heartbeatHandle) {
        return;
      }

      clearInterval(heartbeatHandle);
      heartbeatHandle = undefined;
    };

    const abortStream = () => {
      if (responseFinished || abortController.signal.aborted) {
        return;
      }

      abortController.abort(createAbortError());
    };

    const writeHeartbeat = () => {
      if (reply.raw.destroyed || reply.raw.writableEnded) {
        clearHeartbeat();
        return;
      }

      try {
        reply.raw.write(": keep-alive\n\n");
      } catch {
        clearHeartbeat();
      }
    };

    request.raw.once("aborted", abortStream);
    reply.raw.once("error", () => {
      clearHeartbeat();
      abortStream();
    });
    reply.raw.once("finish", () => {
      responseFinished = true;
      clearHeartbeat();
    });
    reply.raw.once("close", () => {
      clearHeartbeat();

      if (!responseFinished) {
        abortStream();
      }
    });

    try {
      const stream = this.agentService.streamReply(body, abortController.signal);
      reply.hijack();

      pipeUIMessageStreamToResponse({
        headers: {
          "Cache-Control": "no-cache, no-transform",
        },
        response: reply.raw,
        stream,
      });

      writeHeartbeat();
      heartbeatHandle = setInterval(
        writeHeartbeat,
        AGENT_SSE_HEARTBEAT_INTERVAL_MS,
      );
    } catch (error) {
      clearHeartbeat();
      this.writeError(reply, error);
    }
  }
}
