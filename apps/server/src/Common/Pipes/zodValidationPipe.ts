import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ZodError, type ZodType } from "zod";

@Injectable()
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new BadRequestException(this.formatError(result.error));
  }

  private formatError(error: ZodError) {
    return error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.join("."),
    }));
  }
}
