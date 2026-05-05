import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map, type Observable } from "rxjs";

import {
  buildSuccessResponse,
  RAW_RESPONSE_METADATA_KEY,
  type ApiResponse,
} from "../Http/apiResponse.js";

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T | null> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T | null> | T> {
    // 只有普通 HTTP handler 才包装响应；SSE 等原始响应通过 @RawResponse 跳过。
    if (context.getType() !== "http" || this.shouldSkip(context)) {
      return next.handle();
    }

    // Controller 返回的业务 data 被统一包成 { success, data, errorMsg }。
    return next.handle().pipe(map((data) => buildSuccessResponse(data)));
  }

  private shouldSkip(context: ExecutionContext) {
    // Reflector 可以同时读取方法级和类级 metadata。
    return this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
