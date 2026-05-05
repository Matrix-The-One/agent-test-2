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

// 这个 Controller 专门处理 Agent 的流式回复；普通会话 CRUD 在 Conversations 模块中。
@Controller("agent")
@ApiTags("agent")
export class AgentController {
  @Inject(AgentService)
  private readonly agentService!: AgentService;

  private writeError(reply: FastifyReply, error: unknown) {
    const message = this.agentService.normalizeError(error);

    // SSE 连接一旦开始写入 headers，就不能再切回标准 JSON 错误响应。
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
  // 流式响应必须跳过全局 ApiResponseInterceptor，否则 SSE 会被包成 JSON。
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
    // 前端停止生成、刷新页面或网络断开时，用同一个 AbortSignal 传给下游模型和图执行。
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
      // 代理或浏览器可能会关闭长时间无数据的 SSE 连接，心跳用于保持连接活跃。
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

    // Fastify/Node 的几个生命周期事件语义不同，这里统一收敛成清理心跳和中断下游执行。
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
      // hijack 后由 AI SDK 直接写入原始 Node response，Nest 不再接管返回值。
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
