import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

const createWritingBlueprintTool = () =>
  tool(
    async ({
      audience,
      goal,
      topic,
    }: {
      audience: string;
      goal: string;
      topic: string;
    }) =>
      [
        `Topic: ${topic}`,
        `Audience: ${audience}`,
        `Goal: ${goal}`,
        "Writing blueprint:",
        "1. Start with the conclusion or core claim.",
        "2. Expand with background, supporting points, and concrete examples.",
        "3. End with a takeaway, CTA, or next action.",
      ].join("\n"),
    {
      description: "Generate a writing blueprint for articles, blogs, or business copy.",
      name: "content_creation_generate_writing_blueprint",
      schema: z.object({
        audience: z.string().default("general business audience"),
        goal: z.string().default("produce a clear and publishable draft"),
        topic: z.string().min(1),
      }),
    },
  );

const createEditingChecklistTool = () =>
  tool(
    async ({
      contentType,
      focus,
    }: {
      contentType: string;
      focus: string;
    }) =>
      [
        `Content type: ${contentType}`,
        `Editing focus: ${focus}`,
        "Editing checklist:",
        "1. Remove repeated points and weak filler sentences.",
        "2. Make section titles and paragraph flow explicit.",
        "3. Add evidence, examples, or data where claims feel thin.",
        "4. Align tone, terminology, and CTA with the target audience.",
      ].join("\n"),
    {
      description: "Generate a practical editing checklist for rewriting or polishing content.",
      name: "content_creation_generate_editing_checklist",
      schema: z.object({
        contentType: z.string().default("article"),
        focus: z.string().default("clarity and readability"),
      }),
    },
  );

export const createContentCreationSkill = (): AgentSkillDefinition => ({
  category: "content",
  categoryLabel: "内容创作",
  description: "用于文章写作、内容提纲、文案润色和摘要整理等文字任务。",
  id: "content-creation",
  name: "内容创作",
  popularity: "popular",
  routingHints: [
    "文章",
    "写作",
    "文案",
    "博客",
    "总结",
    "摘要",
    "润色",
    "改写",
    "宣传稿",
    "方案说明",
  ],
  tags: ["article", "writing", "outline", "rewrite", "summary"],
  tools: [createWritingBlueprintTool(), createEditingChecklistTool()],
  useCases: [
    "起草文章、博客或对外文案",
    "生成提纲、摘要和标题候选",
    "对已有内容做改写和润色",
  ],
});
