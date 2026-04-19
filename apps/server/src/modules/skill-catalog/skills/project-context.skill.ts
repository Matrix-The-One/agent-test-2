import { tool } from "@langchain/core/tools";
import { z } from "zod";

import {
  RUNTIME_CAPABILITIES,
  STACK_SUMMARY,
} from "../../agent/domain/agent.constants.js";
import { createDescribeProjectStackTool } from "../tools/describe-project-stack.tool.js";
import { createGetCurrentTimeTool } from "../tools/get-current-time.tool.js";
import type { AgentSkillDefinition } from "../domain/agent-skill.types.js";

const createDescribeRuntimeCapabilitiesTool = () =>
  tool(
    async ({ audience }) => {
      const intro =
        audience === "builder"
          ? "面向构建者的运行时能力："
          : "当前运行时能力：";

      return [
        intro,
        ...RUNTIME_CAPABILITIES.map((item) => `- ${item}`),
        `- 前端技术栈：${STACK_SUMMARY.frontend.join("、")}。`,
        `- 后端技术栈：${STACK_SUMMARY.backend.join("、")}。`,
      ].join("\n");
    },
    {
      description: "说明当前 agent 平台的运行时能力与集成边界。",
      name: "project_context_describe_runtime_capabilities",
      schema: z.object({
        audience: z.enum(["general", "builder"]).default("general"),
      }),
    },
  );

export const createProjectContextSkill = (): AgentSkillDefinition => ({
  category: "project",
  categoryLabel: "项目上下文",
  description:
    "用于回答当前项目技术栈、运行时能力、内置 agent 行为、时间和上下文相关问题。",
  id: "project-context",
  name: "项目上下文",
  popularity: "core",
  routingHints: [
    "技术栈",
    "当前项目",
    "能力",
    "上下文",
    "时间",
    "thread",
    "memory",
    "langgraph",
    "现状",
    "能做什么",
  ],
  tags: ["stack", "runtime", "time", "context"],
  tools: [
    createGetCurrentTimeTool(),
    createDescribeProjectStackTool(),
    createDescribeRuntimeCapabilitiesTool(),
  ],
  useCases: [
    "解释当前项目技术栈或运行时能力",
    "回答记忆、流式输出、线程行为等问题",
    "提供当前时间等工具型上下文信息",
  ],
});
