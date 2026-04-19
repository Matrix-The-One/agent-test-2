export type AgentModelSpec = {
  model: string;
  contextWindowTokens: number;
  maxOutputTokens: number;
};

const OPENAI_MODEL_SPECS: Record<string, AgentModelSpec> = {
  "gpt-5.4": {
    contextWindowTokens: 1_050_000,
    maxOutputTokens: 128_000,
    model: "gpt-5.4",
  },
  "gpt-5.4-pro": {
    contextWindowTokens: 1_050_000,
    maxOutputTokens: 128_000,
    model: "gpt-5.4-pro",
  },
  "gpt-5.4-mini": {
    contextWindowTokens: 400_000,
    maxOutputTokens: 128_000,
    model: "gpt-5.4-mini",
  },
  "gpt-5.3-codex": {
    contextWindowTokens: 400_000,
    maxOutputTokens: 128_000,
    model: "gpt-5.3-codex",
  },
  "gpt-5.2": {
    contextWindowTokens: 400_000,
    maxOutputTokens: 128_000,
    model: "gpt-5.2",
  },
  "gpt-5.2-codex": {
    contextWindowTokens: 400_000,
    maxOutputTokens: 128_000,
    model: "gpt-5.2-codex",
  },
};

export const DEFAULT_AGENT_MODEL_SPEC: AgentModelSpec = {
  contextWindowTokens: 200_000,
  maxOutputTokens: 32_000,
  model: "fallback",
};

export const resolveAgentModelSpec = (model: string): AgentModelSpec =>
  OPENAI_MODEL_SPECS[model] ?? {
    ...DEFAULT_AGENT_MODEL_SPEC,
    model,
  };
