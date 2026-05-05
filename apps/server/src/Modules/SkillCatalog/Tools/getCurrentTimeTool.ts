import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const createGetCurrentTimeTool = () =>
  // 时间是运行时事实，必须通过工具获取，而不是让模型按训练时间猜。
  tool(
    async ({ timezone }) =>
      new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "full",
        timeStyle: "long",
        timeZone: timezone,
      }).format(new Date()),
    {
      description: "获取指定 IANA 时区的当前时间。",
      name: "get_current_time",
      schema: z.object({
        timezone: z.string().default("Asia/Shanghai"),
      }),
    },
  );
