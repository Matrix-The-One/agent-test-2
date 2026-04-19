import type {
  AgentSkillCategory,
  AgentSkillId,
} from "../../SkillCatalog/Domain/agentSkillTypes.js";

export const AGENT_INTENTS = ["chat", "writing", "coding", "image"] as const;
export const AGENT_IMAGE_ROLES = [
  "none",
  "analyze",
  "reference",
  "edit",
] as const;

export type AgentIntent = (typeof AGENT_INTENTS)[number];
export type AgentRequestMode = AgentIntent;
export type AgentImageRole = (typeof AGENT_IMAGE_ROLES)[number];

export type AgentImageInput = {
  filename?: string;
  mediaType: string;
  url: string;
};

export type AgentIntentDecision = {
  intent: AgentIntent;
  reason: string;
};

export type AgentImageRoleDecision = {
  hasImages: boolean;
  reason: string;
  role: AgentImageRole;
};

export type AgentWorkflowSkillSelection = {
  reason: string;
  skillIds: AgentSkillId[];
};

export type AgentExecutionContext = {
  hasImages: boolean;
  imageRole: AgentImageRole;
  images: AgentImageInput[];
  intent: AgentIntent;
  message: string;
  threadId: string;
};

export type AgentExecutionMode =
  | "image-placeholder"
  | "dynamic-supervisor"
  | "fixed-chain";

export type AgentTokenCountingMode = "exact" | "tokenizer" | "estimated";
export type AgentContextCompactionStrategy = "none" | "running-summary";

export type AgentContextBudget = {
  model: string;
  countingMode: AgentTokenCountingMode;
  contextWindowTokens: number;
  maxConversationTokens: number;
  reservedInstructionTokens: number;
  reservedOutputTokens: number;
  inputTokens: number;
  usagePercent: number;
  compaction: {
    active: boolean;
    applied: boolean;
    strategy: AgentContextCompactionStrategy;
    summaryMessageCount: number;
  };
};

export type AgentTraceStepKind = "specialist" | "responder";
export type AgentTraceStepStatus = "planned" | "running" | "completed";

export type AgentTraceSpecialist = {
  category: AgentSkillCategory;
  label: string;
  model: string;
  skillIds: AgentSkillId[];
  skillNames: string[];
};

export type AgentTraceStep = {
  id: string;
  kind: AgentTraceStepKind;
  title: string;
  model: string;
  status: AgentTraceStepStatus;
  category?: AgentSkillCategory;
  completedAt?: string;
  durationMs?: number;
  task?: string;
  expectedOutput?: string;
  startedAt?: string;
  summary?: string;
};

export type AgentExecutionPlan = {
  executionMode: AgentExecutionMode;
  availableSpecialists: AgentTraceSpecialist[];
  responder: {
    label: string;
    model: string;
    stepId: string;
  };
  steps: AgentTraceStep[];
};

export type AgentExecutionTrace = {
  startedAt: string;
  updatedAt: string;
  threadId: string;
  requestedMode?: AgentRequestMode;
  hasImages: boolean;
  intent: AgentIntent;
  imageRole: AgentImageRole;
  routingDurationMs: number;
  totalDurationMs?: number;
  routing: {
    imageRoleReason: string;
    intentReason: string;
    skillSelectionReason: string;
    skillIds: AgentSkillId[];
  };
  contextBudget: AgentContextBudget;
  execution: AgentExecutionPlan;
};

export type AgentTraceHooks = {
  onStepUpdate?: (step: AgentTraceStep) => void;
};
