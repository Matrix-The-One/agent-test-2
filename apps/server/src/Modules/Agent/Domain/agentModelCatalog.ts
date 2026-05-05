export type AgentModelSpec = {
  model: string;
  contextWindowTokens: number;
  maxOutputTokens: number;
};

// 本地模型规格表用于上下文预算计算，不直接决定实际调用哪个模型。
const OPENAI_MODEL_SPECS: Record<string, AgentModelSpec> = {
  "gpt-5.5": {
    contextWindowTokens: 1_050_000,
    maxOutputTokens: 128_000,
    model: "gpt-5.5",
  },
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
  // 未登记模型走保守窗口，避免预算过大导致真实模型超窗。
  contextWindowTokens: 200_000,
  maxOutputTokens: 32_000,
  model: "fallback",
};

export const resolveAgentModelSpec = (model: string): AgentModelSpec =>
  // 保留传入 model 名，方便 trace 显示真实配置值。
  OPENAI_MODEL_SPECS[model] ?? {
    ...DEFAULT_AGENT_MODEL_SPEC,
    model,
  };
