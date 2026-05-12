import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

const deliveryModeSchema = z.enum(["quick", "balanced", "deep"]);

const createInteractiveDeliveryBriefTool = () =>
  tool(
    async ({
      mode,
      originalRequest,
    }: {
      mode: z.infer<typeof deliveryModeSchema>;
      originalRequest: string;
    }) => {
      const modeSummary = {
        balanced:
          "Balanced mode: explain the approach, execute the main task, and include validation or risk notes.",
        deep:
          "Deep mode: analyze alternatives, make assumptions explicit, execute thoroughly, and include tradeoffs and verification.",
        quick:
          "Quick mode: produce the shortest useful result with minimal explanation and only essential caveats.",
      } satisfies Record<z.infer<typeof deliveryModeSchema>, string>;

      return [
        `Original request: ${originalRequest}`,
        `Selected delivery mode: ${mode}`,
        modeSummary[mode],
        "Execution guidance:",
        "1. Respect the user's selected mode over the default response style.",
        "2. Keep the final answer directly actionable.",
        "3. Mention assumptions only when they affect the result.",
      ].join("\n");
    },
    {
      description:
        "Create an execution brief after the user has chosen an interactive delivery mode.",
      name: "interactive_delivery_create_execution_brief",
      schema: z.object({
        mode: deliveryModeSchema,
        originalRequest: z.string().trim().min(1).max(4000),
      }),
    },
  );

export const createInteractiveDeliverySkill = (): AgentSkillDefinition => ({
  category: "delivery",
  categoryLabel: "方案选择执行",
  description:
    "用于需要先让用户在页面选择执行方案，再按所选方案继续处理的交互式任务。",
  id: "interactive-delivery",
  name: "方案选择执行",
  popularity: "popular",
  routingHints: [
    "方案选择",
    "选择方案",
    "让我选择",
    "先让我选",
    "interactive delivery",
    "choose a plan",
    "pick an option",
  ],
  tags: ["interactive", "approval", "choice", "delivery", "plan"],
  tools: [createInteractiveDeliveryBriefTool()],
  useCases: [
    "先展示快速、平衡、深入三种执行方案，再由用户选择",
    "用户选择方案后按对应深度继续生成结果",
    "演示 skill 级别的人机确认式执行入口",
  ],
});
