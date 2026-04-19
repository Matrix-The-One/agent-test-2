import type { AgentSkillCategory } from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import type { AgentIntent } from "../../Domain/agentTypes.js";

export type FixedChainStep = {
  category: AgentSkillCategory;
  expectedOutput: string;
  task: string;
};

const FIXED_CHAIN_BY_INTENT: Partial<Record<AgentIntent, readonly FixedChainStep[]>> = {
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
      category: "quality",
      expectedOutput: "A review of correctness, risks, regressions, and missing validation.",
      task: "Review the current coding solution, identify correctness issues and regression risks, and tighten the output for final delivery.",
    },
  ],
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
  ],
};

export const usesFixedSpecialistChain = (intent: AgentIntent) =>
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

  return chain.filter((step) => availableCategorySet.has(step.category));
};
