import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../domain/agent-skill.types.js";

const createPlanCodeChangeSetTool = () =>
  tool(
    async ({ task, language, repositoryScale }) => {
      const scaleGuidance =
        repositoryScale === "large"
          ? "优先锁定模块边界和契约，避免跨目录散改。"
          : repositoryScale === "medium"
            ? "先确认调用链和数据流，再逐步落改动。"
            : "可以用更紧凑的改动链路直接完成。";

      return [
        `“${task}”的代码改造方案：`,
        `- 技术语言：${language}。`,
        `- 仓库规模：${repositoryScale}。${scaleGuidance}`,
        "- 改动顺序：先定义输入输出契约，再改核心服务，最后补控制层或 UI 适配。",
        "- 风险控制：避免在同一轮同时改协议、状态管理和渲染逻辑。",
        "- 验证路径：至少跑与改动直接相关的 typecheck、lint、build 或 targeted tests。",
        "- 交付方式：优先拆成可审阅的小 patch，而不是一次性大改。",
      ].join("\n");
    },
    {
      description: "为代码编辑、重构、缺陷修复生成可执行的改造方案。",
      name: "code_engineering_plan_change_set",
      schema: z.object({
        task: z.string().min(1),
        language: z.string().default("TypeScript"),
        repositoryScale: z.enum(["small", "medium", "large"]).default("large"),
      }),
    },
  );

const createReviewRegressionRisksTool = () =>
  tool(
    async ({ changeType, hasUi }) =>
      [
        `“${changeType}”的回归风险清单：`,
        "- 契约风险：检查请求/响应结构、事件 payload 和类型定义是否同步更新。",
        "- 状态风险：确认默认值、异常分支和空数据分支仍然可达。",
        `- 界面风险：${hasUi ? "需要额外检查 loading、error、empty 三种 UI 状态。" : "本轮以服务端行为和接口兼容性为主。"}`,
        "- 依赖风险：确认没有引入循环依赖、重复 provider 或过度共享状态。",
        "- 验证建议：保留一个成功路径和一个失败路径做回归验证。",
      ].join("\n"),
    {
      description: "为代码改动提供 review 重点和回归风险清单。",
      name: "code_engineering_review_regression_risks",
      schema: z.object({
        changeType: z.string().min(1),
        hasUi: z.boolean().default(false),
      }),
    },
  );

export const createCodeEngineeringSkill = (): AgentSkillDefinition => ({
  category: "engineering",
  categoryLabel: "代码工程",
  description: "用于代码编辑、重构、修复缺陷、接口改造和代码评审等研发场景。",
  id: "code-engineering",
  name: "代码工程",
  popularity: "popular",
  routingHints: [
    "代码",
    "编码",
    "开发",
    "编辑代码",
    "重构",
    "修复",
    "bug",
    "接口",
    "api",
    "实现",
    "typescript",
    "nestjs",
    "react",
  ],
  tags: ["code-editing", "refactor", "review", "typescript", "engineering"],
  tools: [
    createPlanCodeChangeSetTool(),
    createReviewRegressionRisksTool(),
  ],
  useCases: [
    "规划代码改造和重构顺序",
    "识别服务端或前端改动的回归风险",
    "对代码编辑任务给出更工程化的实施方式",
  ],
});
