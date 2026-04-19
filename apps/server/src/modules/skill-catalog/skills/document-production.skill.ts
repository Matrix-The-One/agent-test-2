import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../domain/agent-skill.types.js";

const formatLabel = {
  docx: "Word (DOCX)",
  markdown: "Markdown",
  pdf: "PDF",
  xlsx: "Excel (XLSX)",
} as const;

type SupportedDocumentFormat = keyof typeof formatLabel;

const formatGuidance: Record<SupportedDocumentFormat, string[]> = {
  docx: [
    "- 结构建议：封面/标题、摘要、分级标题、正文、附录。",
    "- 编辑要求：用稳定样式管理标题、正文、表格和引用，便于继续二次编辑。",
    "- 交付注意：如果后续还要继续修改，DOCX 应保留为主源文件。",
  ],
  markdown: [
    "- 结构建议：一级标题、摘要、二级章节、代码块或表格、附录。",
    "- 编辑要求：适合程序化生成和版本管理，便于后续再导出 PDF/Word。",
    "- 交付注意：当文档需要长期版本化维护时，Markdown 更稳妥。",
  ],
  pdf: [
    "- 结构建议：封面、目录、分页正文、页眉页脚、附件页。",
    "- 编辑要求：确定页面尺寸、页边距、分页规则和打印场景。",
    "- 交付注意：PDF 适合归档和打印，但通常需要配套保留可编辑源文件。",
  ],
  xlsx: [
    "- 结构建议：按主题拆工作表，区分原始数据、计算区和展示区。",
    "- 编辑要求：明确表头、数据验证、公式区域、冻结窗格和筛选规则。",
    "- 交付注意：如果含汇总或公式，优先给出单元格约定和字段字典。",
  ],
};

const createDesignDocumentDeliveryPlanTool = () =>
  tool(
    async ({ format, goal, includesCharts }) =>
      [
        `“${goal}”的 ${formatLabel[format]} 交付方案：`,
        ...formatGuidance[format],
        includesCharts
          ? "- 图表策略：提前确定图表来源、尺寸和配色，避免导出后错位。"
          : "- 图表策略：当前可先以文本、表格或占位说明处理。",
        "- 文件组织：建议统一业务主题、日期和版本号，避免后续文件散落。",
        "- 交付检查：确认是否还需要同时输出可编辑源文件、打印稿或结构化数据。",
      ].join("\n"),
    {
      description: "为 Markdown、Word、Excel、PDF 等文件生成场景设计交付方案。",
      name: "document_production_design_delivery_plan",
      schema: z.object({
        format: z.enum(["markdown", "docx", "xlsx", "pdf"]).default("markdown"),
        goal: z.string().min(1),
        includesCharts: z.boolean().default(false),
      }),
    },
  );

const createRecommendOutputBundleTool = () =>
  tool(
    async ({ scenario, needsEditing, needsPrint, needsStructuredData }) => {
      const primaryFormat: SupportedDocumentFormat = needsStructuredData
        ? "xlsx"
        : needsPrint
          ? "pdf"
          : needsEditing
            ? "docx"
            : "markdown";

      const bundle = new Set<SupportedDocumentFormat>([primaryFormat]);

      if (primaryFormat === "pdf") {
        bundle.add(needsEditing ? "docx" : "markdown");
      }

      if (primaryFormat === "xlsx" && needsPrint) {
        bundle.add("pdf");
      }

      if (primaryFormat === "docx" && needsStructuredData) {
        bundle.add("xlsx");
      }

      return [
        `“${scenario}”的推荐文件组合：`,
        `- 主格式：${formatLabel[primaryFormat]}。`,
        `- 选择依据：${needsStructuredData ? "需要结构化数据或表格计算。" : needsPrint ? "需要稳定打印或归档输出。" : needsEditing ? "需要后续继续编辑和协作修订。" : "更适合版本化维护和自动生成。"} `,
        `- 建议配套：${Array.from(bundle).map((item) => formatLabel[item]).join("、")}。`,
        "- 命名建议：按业务主题 + 日期或版本号组织文件。",
        "- 交付提醒：明确哪些文件是主源，哪些是展示稿，避免多人协作时改错版本。",
      ].join("\n");
    },
    {
      description: "根据业务场景推荐 Word、Excel、PDF、Markdown 的文件组合。",
      name: "document_production_recommend_output_bundle",
      schema: z.object({
        scenario: z.string().min(1),
        needsEditing: z.boolean().default(true),
        needsPrint: z.boolean().default(false),
        needsStructuredData: z.boolean().default(false),
      }),
    },
  );

export const createDocumentProductionSkill = (): AgentSkillDefinition => ({
  category: "document",
  categoryLabel: "文档工坊",
  description:
    "用于文件生成和交付设计，覆盖 Markdown、Word、Excel、PDF 等常见办公文档场景。",
  id: "document-production",
  name: "文档工坊",
  popularity: "popular",
  routingHints: [
    "文件",
    "文档",
    "生成文件",
    "excel",
    "xlsx",
    "xlas",
    "表格",
    "pdf",
    "word",
    "docx",
    "报告",
    "导出",
    "附件",
  ],
  tags: ["file-generation", "markdown", "docx", "xlsx", "pdf", "word", "excel"],
  tools: [
    createDesignDocumentDeliveryPlanTool(),
    createRecommendOutputBundleTool(),
  ],
  useCases: [
    "设计 Excel、PDF、Word、Markdown 的输出结构",
    "为文件生成任务选择合适的主格式和配套格式",
    "规划办公文档、报告、附件和结构化表格的交付方式",
  ],
});
