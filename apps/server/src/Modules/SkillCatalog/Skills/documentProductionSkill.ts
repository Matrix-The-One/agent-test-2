import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

const createDocumentOutlineTool = () =>
  // 文档提纲工具负责结构，不负责真实文件创建。
  tool(
    async ({
      documentType,
      goal,
    }: {
      documentType: string;
      goal: string;
    }) =>
      [
        `Document type: ${documentType}`,
        `Goal: ${goal}`,
        "Suggested outline:",
        "1. Cover page or document header",
        "2. Background and objective",
        "3. Main content or proposal body",
        "4. Risks, assumptions, and next actions",
        "5. Appendix or supporting references",
      ].join("\n"),
    {
      description: "Generate an outline for a report, proposal, or formal document.",
      name: "document_production_generate_outline",
      schema: z.object({
        documentType: z.string().default("report"),
        goal: z.string().default("prepare a deliverable document"),
      }),
    },
  );

const createDeliveryFormatTool = () =>
  // 格式清单帮助 document specialist 把内容转成可交付文档形态。
  tool(
    async ({
      audience,
      format,
    }: {
      audience: string;
      format: string;
    }) =>
      [
        `Format: ${format}`,
        `Audience: ${audience}`,
        "Formatting checklist:",
        "1. Keep section hierarchy explicit and stable.",
        "2. Use short summaries before dense detail.",
        "3. Preserve reusable placeholders for figures, tables, and references.",
        "4. Make the final file easy to continue editing or exporting.",
      ].join("\n"),
    {
      description: "Generate a formatting checklist for a document deliverable.",
      name: "document_production_generate_format_checklist",
      schema: z.object({
        audience: z.string().default("stakeholders"),
        format: z.string().default("docx or pdf"),
      }),
    },
  );

export const createDocumentProductionSkill = (): AgentSkillDefinition => ({
  // document category 主要用于 writing fixed-chain 的后段整理。
  category: "document",
  categoryLabel: "文档生产",
  description: "用于报告、方案、汇报和正式文档类交付物的结构设计与整理。",
  id: "document-production",
  name: "文档生产",
  popularity: "popular",
  routingHints: [
    "word",
    "pdf",
    "docx",
    "文档",
    "报告",
    "方案",
    "汇报",
    "交付件",
  ],
  tags: ["document", "report", "proposal", "outline", "deliverable"],
  tools: [createDocumentOutlineTool(), createDeliveryFormatTool()],
  useCases: [
    "整理正式报告或汇报文档",
    "把内容转成可交付的文档结构",
    "为 Word 或 PDF 输出准备提纲和格式要求",
  ],
});
