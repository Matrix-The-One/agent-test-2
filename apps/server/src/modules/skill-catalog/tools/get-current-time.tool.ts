import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const createGetCurrentTimeTool = () =>
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
