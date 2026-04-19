import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { STACK_SUMMARY } from "../../agent/domain/agent.constants.js";

export const createDescribeProjectStackTool = () =>
  tool(
    async ({ focus }) => {
      if (focus === "frontend") {
        return `前端技术栈：${STACK_SUMMARY.frontend.join("、")}。`;
      }

      if (focus === "backend") {
        return `后端技术栈：${STACK_SUMMARY.backend.join("、")}。`;
      }

      return [
        `前端技术栈：${STACK_SUMMARY.frontend.join("、")}。`,
        `后端技术栈：${STACK_SUMMARY.backend.join("、")}。`,
      ].join("\n");
    },
    {
      description: "返回当前项目的技术栈，并区分前端和后端。",
      name: "describe_project_stack",
      schema: z.object({
        focus: z.enum(["all", "frontend", "backend"]).default("all"),
      }),
    },
  );
