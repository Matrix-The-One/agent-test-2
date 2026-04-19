import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

const createImplementationChecklistTool = () =>
  tool(
    async ({ stack, task }: { stack: string; task: string }) =>
      [
        `Task: ${task}`,
        `Stack: ${stack}`,
        "Implementation checklist:",
        "1. Confirm input, output, edge cases, and failure modes.",
        "2. Reuse existing modules and conventions before adding new abstractions.",
        "3. Build the smallest working path first, then add validation and error handling.",
        "4. Run checks that are directly related to the changed code.",
      ].join("\n"),
    {
      description: "Generate a practical implementation checklist for an engineering task.",
      name: "code_engineering_generate_implementation_checklist",
      schema: z.object({
        stack: z.string().default("TypeScript / Node.js"),
        task: z.string().min(1),
      }),
    },
  );

const createDebugChecklistTool = () =>
  tool(
    async ({
      symptom,
      systemArea,
    }: {
      symptom: string;
      systemArea: string;
    }) =>
      [
        `Symptom: ${symptom}`,
        `Area: ${systemArea}`,
        "Debug checklist:",
        "1. Reproduce the issue with the smallest possible input.",
        "2. Add logs or probes around the failing branch and data boundary.",
        "3. Check assumptions around nullability, async timing, and configuration.",
        "4. Verify the fix with the original failing scenario and one adjacent regression case.",
      ].join("\n"),
    {
      description: "Generate a focused debugging checklist for a code issue.",
      name: "code_engineering_generate_debug_checklist",
      schema: z.object({
        symptom: z.string().min(1),
        systemArea: z.string().default("backend service"),
      }),
    },
  );

export const createCodeEngineeringSkill = (): AgentSkillDefinition => ({
  category: "engineering",
  categoryLabel: "代码工程",
  description: "用于代码实现、调试、重构和接口开发等工程型任务。",
  id: "code-engineering",
  name: "代码工程",
  popularity: "popular",
  routingHints: [
    "代码",
    "开发",
    "调试",
    "修复",
    "重构",
    "接口",
    "脚本",
    "服务端",
    "前端",
    "后端",
  ],
  tags: ["code", "implementation", "debug", "refactor", "api"],
  tools: [createImplementationChecklistTool(), createDebugChecklistTool()],
  useCases: [
    "拆解一个实现任务的最小落地路径",
    "整理排错步骤和验证清单",
    "辅助接口开发、模块改造和代码修复",
  ],
});
