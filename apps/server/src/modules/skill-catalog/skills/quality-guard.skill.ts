import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../domain/agent-skill.types.js";

const createSuggestTestStrategyTool = () =>
  tool(
    async ({ feature }) =>
      [
        `“${feature}”的测试策略：`,
        "- 单元测试：覆盖 skill 路由归一化、回退逻辑，以及纯 skill 函数输出。",
        "- 集成测试：验证命中的 skills 是否被正确转换成 agent 可用工具集。",
        "- API 测试：请求流式接口，断言返回存在有效增量内容。",
        "- 回归测试：保留一个模糊请求，验证 router fallback 仍能给出可用结果。",
      ].join("\n"),
    {
      description: "为一个功能生成聚焦的测试策略，覆盖单元、集成和 API 层。",
      name: "quality_guard_suggest_test_strategy",
      schema: z.object({
        feature: z.string().min(1),
      }),
    },
  );

const createSuggestObservabilityPlanTool = () =>
  tool(
    async ({ feature }) =>
      [
        `“${feature}”的可观测性方案：`,
        "- 为每次请求记录命中的 skill IDs。",
        "- 分开统计 router 模型耗时和主 agent 耗时。",
        "- 按 skill 和 tool name 记录工具调用次数。",
        "- 记录结构化路由失败后的 fallback 比例。",
        "- 为每个线程记录 breadcrumb，便于回放跨轮路由行为。",
      ].join("\n"),
    {
      description: "为生产环境中的某个功能补充日志、指标和追踪建议。",
      name: "quality_guard_suggest_observability_plan",
      schema: z.object({
        feature: z.string().min(1),
      }),
    },
  );

export const createQualityGuardSkill = (): AgentSkillDefinition => ({
  category: "quality",
  categoryLabel: "质量护栏",
  description: "用于测试、可观测性和多 skill agent 行为的质量约束。",
  id: "quality-guard",
  name: "质量护栏",
  popularity: "core",
  routingHints: [
    "测试",
    "质量",
    "监控",
    "观测",
    "trace",
    "日志",
    "review",
    "回归",
    "验收",
  ],
  tags: ["test", "observability", "logging", "review"],
  tools: [
    createSuggestTestStrategyTool(),
    createSuggestObservabilityPlanTool(),
  ],
  useCases: [
    "为路由或工具执行设计测试",
    "补充日志、指标和追踪",
    "上线前审查质量风险",
  ],
});
