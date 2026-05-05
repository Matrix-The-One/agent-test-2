import type { AgentSkillCategory } from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import type { AgentIntent } from "../../Domain/agentTypes.js";

// fixed-chain 是“代码写死的专家流水线”，用于 coding/writing 这类阶段明确的任务。
export type FixedChainStep = {
  category: AgentSkillCategory;
  expectedOutput: string;
  task: string;
};

const FIXED_CHAIN_BY_INTENT: Partial<Record<AgentIntent, readonly FixedChainStep[]>> = {
  // coding 链路强调上下文、架构/计划、实现、产物、质量检查。
  coding: [
    {
      category: "project",
      expectedOutput: "A short context brief with only facts that matter for implementation.",
      task: "Extract only the project or runtime context that is necessary for the downstream coding work.",
    },
    {
      category: "architecture",
      expectedOutput: "A concise architecture or module-boundary plan for the implementation.",
      task: "Decide the module boundaries, layering impact, and structural approach if architecture choices matter.",
    },
    {
      category: "delivery",
      expectedOutput: "A compact execution plan for how to land the change safely.",
      task: "Break the work into a short, implementation-oriented sequence if staged delivery matters.",
    },
    {
      category: "engineering",
      expectedOutput: "The main implementation answer, draft, or technical solution.",
      task: "Produce the main coding solution, implementation notes, or debugging outcome based on the upstream context.",
    },
    {
      category: "artifact",
      expectedOutput:
        "Created file paths and a short note about any generated workspace artifacts.",
      task: "Create the requested code, text, document, or spreadsheet files when the user explicitly asks for a file artifact.",
    },
    {
      category: "quality",
      expectedOutput: "A review of correctness, risks, regressions, and missing validation.",
      task: "Review the current coding solution, identify correctness issues and regression risks, and tighten the output for final delivery.",
    },
  ],
  // writing 链路强调上下文、正文、文档结构、可选文件产物。
  writing: [
    {
      category: "project",
      expectedOutput: "Only the contextual facts or constraints that shape the writing output.",
      task: "Provide the minimal project or domain context that should influence the written output.",
    },
    {
      category: "content",
      expectedOutput: "The main written draft or rewritten content.",
      task: "Produce the main writing draft, rewrite, or outline based on the user request.",
    },
    {
      category: "document",
      expectedOutput: "A polished deliverable structure with clear formatting and sections.",
      task: "Turn the current writing draft into a stronger deliverable form, with explicit structure and formatting guidance where useful.",
    },
    {
      category: "artifact",
      expectedOutput:
        "Created file paths and a short note about any generated workspace artifacts.",
      task: "Create the requested text, markdown, docx, xlsx, or code files when the user explicitly asks for a file artifact.",
    },
  ],
};

export const usesFixedSpecialistChain = (intent: AgentIntent) =>
  // 其他 intent 走 dynamic-supervisor，让模型自己决定是否调用 specialist。
  intent === "coding" || intent === "writing";

export const resolveFixedChainSteps = ({
  availableCategories,
  intent,
}: {
  availableCategories: readonly AgentSkillCategory[];
  intent: AgentIntent;
}) => {
  const chain = FIXED_CHAIN_BY_INTENT[intent];

  if (!chain) {
    return [];
  }

  const availableCategorySet = new Set(availableCategories);

  // 只保留本轮 skill 路由实际选中的 specialist，避免执行不存在的链路步骤。
  return chain.filter((step) => availableCategorySet.has(step.category));
};
