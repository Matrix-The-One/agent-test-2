import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../domain/agent-skill.types.js";

const createGenerateImplementationPlanTool = () =>
  tool(
    async ({ feature, phases }) =>
      [
        `“${feature}”的实施计划：`,
        ...Array.from({ length: phases }, (_, index) => {
          const step = index + 1;

          return `${step}. 第 ${step} 阶段：先定义边界和契约，再落最小可运行链路，验证后逐步扩展。`;
        }),
        "验证建议：先跑 typecheck/build，再补与变更路径直接相关的测试。",
      ].join("\n"),
    {
      description: "为一个功能或架构改动生成分阶段实施计划。",
      name: "delivery_planning_generate_implementation_plan",
      schema: z.object({
        feature: z.string().min(1),
        phases: z.number().int().min(2).max(6).default(4),
      }),
    },
  );

const createIdentifyDeliveryRisksTool = () =>
  tool(
    async ({ feature }) =>
      [
        `“${feature}”的交付风险：`,
        "- 路由漂移：快速模型可能少选或多选 skills，如果没有回退策略会影响结果稳定性。",
        "- 工具膨胀：skill 函数过多且语义重叠时，会干扰执行 agent 的决策。",
        "- 线程一致性：记忆按 thread 持久化，如果路由不稳，多轮上下文容易串台。",
        "- 契约偏移：如果后端后续开始返回结构化元数据，前端假设可能失效。",
        "- 测试缺口：tool-routing 分支往往在正常输入下通过，但在模糊请求下暴露问题。",
      ].join("\n"),
    {
      description: "识别一个功能或架构决策的主要交付与上线风险。",
      name: "delivery_planning_identify_delivery_risks",
      schema: z.object({
        feature: z.string().min(1),
      }),
    },
  );

export const createDeliveryPlanningSkill = (): AgentSkillDefinition => ({
  category: "delivery",
  categoryLabel: "交付规划",
  description: "用于分阶段上线方案、实施顺序规划和交付风险分析。",
  id: "delivery-planning",
  name: "交付规划",
  popularity: "core",
  routingHints: [
    "计划",
    "步骤",
    "实施",
    "迭代",
    "roadmap",
    "phase",
    "risk",
    "风险",
    "里程碑",
  ],
  tags: ["planning", "roadmap", "risk", "delivery"],
  tools: [
    createGenerateImplementationPlanTool(),
    createIdentifyDeliveryRisksTool(),
  ],
  useCases: [
    "把一个需求拆成可执行阶段",
    "识别上线风险和依赖关系",
    "把架构想法落成实施顺序",
  ],
});
