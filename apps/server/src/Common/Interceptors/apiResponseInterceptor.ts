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
    if (context.getType() !== "http" || this.shouldSkip(context)) {
      return next.handle();
    }

    return next.handle().pipe(map((data) => buildSuccessResponse(data)));
  }

  private shouldSkip(context: ExecutionContext) {
    return this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
