import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

const createArchitectureChecklistTool = () =>
  // 架构清单工具帮助 architecture specialist 聚焦边界、依赖和取舍。
  tool(
    async ({
      constraints,
      goal,
    }: {
      constraints: string;
      goal: string;
    }) =>
      [
        `Goal: ${goal}`,
        `Constraints: ${constraints}`,
        "Architecture checklist:",
        "1. Keep module boundaries explicit and dependency flow one-way.",
        "2. Prefer feature modules with clear Application / Domain / Infrastructure / Presentation roles.",
        "3. Keep the change minimal and reversible before broader cleanup.",
        "4. Document tradeoffs around extensibility, coupling, and runtime behavior.",
      ].join("\n"),
    {
      description: "Generate a backend architecture checklist for a feature or refactor.",
      name: "solution_architecture_generate_checklist",
      schema: z.object({
        constraints: z.string().default("existing NestJS structure"),
        goal: z.string().min(1),
      }),
    },
  );

export const createSolutionArchitectureSkill = (): AgentSkillDefinition => ({
  // architecture category 在 coding 任务涉及模块划分/设计时加入 fixed-chain。
  category: "architecture",
  categoryLabel: "架构设计",
  description: "用于模块划分、目录结构调整、分层约束和系统设计取舍分析。",
  id: "solution-architecture",
  name: "架构设计",
  popularity: "popular",
  routingHints: [
    "架构",
    "设计",
    "模块",
    "分层",
    "目录结构",
    "architecture",
    "design",
  ],
  tags: ["architecture", "module", "backend", "refactor", "design"],
  tools: [createArchitectureChecklistTool()],
  useCases: [
    "设计后端 feature module 划分",
    "梳理 Application / Domain / Infrastructure / Presentation 的职责",
    "分析目录、命名和依赖方向是否合理",
  ],
});
