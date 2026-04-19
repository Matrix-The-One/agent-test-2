import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { AbstractHttpAdapter } from "@nestjs/core";

import { buildErrorResponse } from "../Http/apiResponse.js";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapter: AbstractHttpAdapter) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<{
      headers?: {
        accept?: string;
      };
      url?: string;
    }>();
    const response = context.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalizeException(exception, status);

    if (this.isStreamRequest(request)) {
      this.httpAdapter.reply(response, normalized.errorMsg, status);
      return;
    }

    this.httpAdapter.reply(
      response,
      {
        ...buildErrorResponse(normalized),
        path: request.url,
        statusCode: status,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }

  private isStreamRequest(request: {
    headers?: {
      accept?: string;
    };
    url?: string;
  }) {
    return request.url?.includes("/agent/stream")
      || request.headers?.accept?.includes("text/event-stream");
  }

  private normalizeException(exception: unknown, status: number) {
    if (!(exception instanceof HttpException)) {
      return {
        errorCode: this.getDefaultErrorCode(status),
        errorMsg: "Unexpected server error",
      };
    }

    const response = exception.getResponse();

    if (typeof response === "string") {
      return {
        errorCode: this.getDefaultErrorCode(status),
        errorMsg: response,
      };
    }

    if (response && typeof response === "object") {
      const body = response as Record<string, unknown>;
      const errorCode =
        typeof body.errorCode === "string"
          ? body.errorCode
          : this.getDefaultErrorCode(status);
      const errors = body.errors ?? body.message;
      const errorMsg =
        this.formatMessage(body.message)
        ?? this.formatMessage(body.error)
        ?? exception.message
        ?? "Request failed";

      return {
        errorCode,
        errorMsg,
        ...(errors === undefined ? {} : { errors }),
      };
    }

    return {
      errorCode: this.getDefaultErrorCode(status),
      errorMsg: exception.message,
    };
  }

  private formatMessage(value: unknown) {
    if (typeof value === "string") {
      return value;
    }

    if (!Array.isArray(value)) {
      return undefined;
    }

    const messages = value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (!item || typeof item !== "object") {
          return undefined;
        }

        const issue = item as {
          message?: unknown;
          path?: unknown;
        };

        if (typeof issue.message !== "string") {
          return undefined;
        }

        if (typeof issue.path === "string" && issue.path.length > 0) {
          return `${issue.path}: ${issue.message}`;
        }

        return issue.message;
      })
      .filter((message): message is string => Boolean(message));

    return messages.length > 0 ? messages.join("; ") : undefined;
  }

  private getDefaultErrorCode(status: number) {
    const statusName = HttpStatus[status];
    return typeof statusName === "string" ? statusName : "HTTP_ERROR";
  }
}
