import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

const createDeliveryPlanTool = () =>
  tool(
    async ({ scope, timeline }: { scope: string; timeline: string }) =>
      [
        `Scope: ${scope}`,
        `Timeline: ${timeline}`,
        "Delivery plan:",
        "1. Define milestones and a minimal first delivery.",
        "2. Split work into independently verifiable tasks.",
        "3. Mark dependencies, blockers, and validation checkpoints.",
        "4. Reserve time for integration, regression checks, and rollout.",
      ].join("\n"),
    {
      description: "Generate a phased delivery plan for a feature or engineering task.",
      name: "delivery_planning_generate_plan",
      schema: z.object({
        scope: z.string().min(1),
        timeline: z.string().default("this sprint"),
      }),
    },
  );

export const createDeliveryPlanningSkill = (): AgentSkillDefinition => ({
  category: "delivery",
  categoryLabel: "交付规划",
  description: "用于特性拆解、阶段排期、任务切分和里程碑规划。",
  id: "delivery-planning",
  name: "交付规划",
  popularity: "popular",
  routingHints: [
    "计划",
    "排期",
    "里程碑",
    "拆分任务",
    "roadmap",
    "milestone",
    "delivery",
  ],
  tags: ["plan", "roadmap", "milestone", "scope", "delivery"],
  tools: [createDeliveryPlanTool()],
  useCases: [
    "拆解一个较大的开发任务",
    "设计阶段性交付和里程碑",
    "整理依赖关系和风险点",
  ],
});
