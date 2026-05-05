import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ZodError, type ZodType } from "zod";

@Injectable()
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown) {
    // Controller 入参先过 Zod schema，成功后返回解析后的强类型数据。
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new BadRequestException(this.formatError(result.error));
  }

  private formatError(error: ZodError) {
    // 保留 path，前端或调试日志可以知道具体哪个字段没通过校验。
    return error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.join("."),
    }));
  }
}
