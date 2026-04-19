import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../domain/agent-skill.types.js";

const createGenerateWritingBlueprintTool = () =>
  tool(
    async ({ topic, audience, goal }) =>
      [
        `“${topic}”的写作蓝图：`,
        `- 目标读者：${audience}。`,
        `- 写作目标：${goal}。`,
        "- 建议结构：标题/摘要、问题背景、核心观点、论据或案例、行动建议、结尾。",
        "- 起稿顺序：先列 3 到 5 个一级段落，再补每段论点、事实和例子。",
        "- 交付物：可同时生成标题候选、摘要、正文提纲和结尾 CTA。",
        "- 风格要求：优先清晰、具体、可执行，避免空泛口号和重复表述。",
      ].join("\n"),
    {
      description: "为文章、博客、方案说明等内容生成写作蓝图。",
      name: "content_creation_generate_writing_blueprint",
      schema: z.object({
        topic: z.string().min(1),
        audience: z.string().default("通用业务读者"),
        goal: z.string().default("输出一篇结构完整、可直接扩写的文章"),
      }),
    },
  );

const createSuggestEditingPassesTool = () =>
  tool(
    async ({ contentType, focus }) =>
      [
        `“${contentType}”的润色检查单：`,
        "- 第一遍：检查是否先给结论，再展开论证和例子。",
        `- 第二遍：重点优化${focus}，删除重复句、弱连接词和口语赘述。`,
        "- 第三遍：补充事实、案例、数字或引用占位，避免只有观点没有支撑。",
        "- 第四遍：统一标题层级、术语、口吻和段落长度。",
        "- 发布前：确认标题、摘要、关键词和结尾动作都明确可执行。",
      ].join("\n"),
    {
      description: "为文章、说明文、方案文档提供润色和改写检查单。",
      name: "content_creation_suggest_editing_passes",
      schema: z.object({
        contentType: z.string().min(1).default("文章"),
        focus: z.string().default("清晰度和可读性"),
      }),
    },
  );

export const createContentCreationSkill = (): AgentSkillDefinition => ({
  category: "content",
  categoryLabel: "内容创作",
  description: "用于文章编写、内容提纲、文案润色、摘要提炼等常见内容生产场景。",
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
  tools: [
    createGenerateWritingBlueprintTool(),
    createSuggestEditingPassesTool(),
  ],
  useCases: [
    "撰写文章、博客、方案说明",
    "生成大纲、摘要和标题候选",
    "对已有文案做改写和润色",
  ],
});
