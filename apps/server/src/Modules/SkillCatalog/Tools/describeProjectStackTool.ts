import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { STACK_SUMMARY } from "../../Agent/Domain/agentConstants.js";

const formatStack = (label: string, items: readonly string[]) =>
  `${label}: ${items.join(" / ")}`;

export const createDescribeProjectStackTool = () =>
  // 给 project specialist 提供稳定的项目技术栈事实，避免模型凭空猜测。
  tool(
    async ({ focus }: { focus: "all" | "frontend" | "backend" }) => {
      if (focus === "frontend") {
        return formatStack("Frontend stack", STACK_SUMMARY.frontend);
      }

      if (focus === "backend") {
        return formatStack("Backend stack", STACK_SUMMARY.backend);
      }

      return [
        formatStack("Frontend stack", STACK_SUMMARY.frontend),
        formatStack("Backend stack", STACK_SUMMARY.backend),
      ].join("\n");
    },
    {
      description: "Return the current project stack, split by frontend and backend.",
      name: "describe_project_stack",
      schema: z.object({
        focus: z.enum(["all", "frontend", "backend"]).default("all"),
      }),
    },
  );
