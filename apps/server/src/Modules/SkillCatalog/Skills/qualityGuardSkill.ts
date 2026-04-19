import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

const createReviewChecklistTool = () =>
  tool(
    async ({
      changeType,
      riskFocus,
    }: {
      changeType: string;
      riskFocus: string;
    }) =>
      [
        `Change type: ${changeType}`,
        `Risk focus: ${riskFocus}`,
        "Review checklist:",
        "1. Verify the new behavior against existing contracts and edge cases.",
        "2. Check whether imports, config, and naming stay consistent after refactors.",
        "3. Confirm tests or validation cover the changed path.",
        "4. Call out regressions, missing checks, and rollout risks explicitly.",
      ].join("\n"),
    {
      description: "Generate a review checklist focused on correctness and regression risk.",
      name: "quality_guard_generate_review_checklist",
      schema: z.object({
        changeType: z.string().default("refactor"),
        riskFocus: z.string().default("behavior regressions"),
      }),
    },
  );

export const createQualityGuardSkill = (): AgentSkillDefinition => ({
  category: "quality",
  categoryLabel: "质量护栏",
  description: "用于 code review、风险检查、回归范围判断和质量问题提示。",
  id: "quality-guard",
  name: "质量护栏",
  popularity: "popular",
  routingHints: ["review", "评审", "测试", "回归", "质量", "风险"],
  tags: ["review", "quality", "risk", "regression", "test"],
  tools: [createReviewChecklistTool()],
  useCases: [
    "做一次以正确性、风险和测试缺口为主的评审",
    "给出需要补做的校验项和回归建议",
    "帮助研判变更的高风险点",
  ],
});
