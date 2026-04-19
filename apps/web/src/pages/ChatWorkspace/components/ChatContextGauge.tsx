import {
  CHAT_AGENT_TOKEN_COUNTING_MODE_LABELS,
  type ChatAgentContextBudget,
} from "@/store/chat/types";

const GAUGE_RADIUS = 16;
const GAUGE_STROKE_WIDTH = 3.5;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const formatTokenCount = (value: number) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }

  return `${value}`;
};

const getGaugeColor = (value: number) => {
  if (value >= 85) {
    return "var(--danger)";
  }

  if (value >= 65) {
    return "#d97706";
  }

  return "var(--primary)";
};

const getCompactionLabel = (budget: ChatAgentContextBudget | null) => {
  if (!budget) {
    return "等待上下文预算";
  }

  if (budget.compaction.applied) {
    return "本轮已自动压缩";
  }

  if (budget.compaction.active) {
    return "已启用摘要压缩";
  }

  return "未压缩";
};

type ChatContextGaugeProps = {
  budget: ChatAgentContextBudget | null;
  isBusy: boolean;
};

export const ChatContextGauge = ({
  budget,
  isBusy,
}: ChatContextGaugeProps) => {
  const usagePercent = Math.max(0, Math.min(100, budget?.usagePercent ?? 0));
  const progressOffset =
    GAUGE_CIRCUMFERENCE - (usagePercent / 100) * GAUGE_CIRCUMFERENCE;
  const gaugeColor = getGaugeColor(usagePercent);
  const label = getCompactionLabel(budget);
  const title = budget
    ? [
        `模型: ${budget.model}`,
        `会话上下文: ${budget.inputTokens} / ${budget.maxConversationTokens} tokens`,
        `窗口利用率: ${budget.usagePercent}%`,
        `压缩状态: ${label}`,
        `计数模式: ${CHAT_AGENT_TOKEN_COUNTING_MODE_LABELS[budget.countingMode]}`,
      ].join("\n")
    : "等待当前会话的上下文预算";

  return (
    <div
      className="inline-flex items-center gap-3 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--foreground)] shadow-[var(--shadow-soft)]"
      title={title}
    >
      <div className="relative h-10 w-10 shrink-0">
        <svg
          className={`h-10 w-10 ${!budget && isBusy ? "animate-pulse" : ""}`}
          viewBox="0 0 40 40"
        >
          <circle
            cx="20"
            cy="20"
            fill="none"
            r={GAUGE_RADIUS}
            stroke="color-mix(in srgb, var(--border) 88%, transparent)"
            strokeWidth={GAUGE_STROKE_WIDTH}
          />
          <circle
            cx="20"
            cy="20"
            fill="none"
            r={GAUGE_RADIUS}
            stroke={budget ? gaugeColor : "color-mix(in srgb, var(--primary) 35%, transparent)"}
            strokeDasharray={GAUGE_CIRCUMFERENCE}
            strokeDashoffset={budget ? progressOffset : GAUGE_CIRCUMFERENCE * 0.75}
            strokeLinecap="round"
            strokeWidth={GAUGE_STROKE_WIDTH}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "20px 20px",
              transition: "stroke-dashoffset 240ms ease, stroke 240ms ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">
          {budget ? `${Math.round(usagePercent)}%` : "--"}
        </div>
      </div>

      <div className="hidden min-w-0 sm:block">
        <div className="text-[11px] font-medium leading-none">
          {budget
            ? `${formatTokenCount(budget.inputTokens)} / ${formatTokenCount(budget.maxConversationTokens)}`
            : "等待 token 预算"}
        </div>
        <div className="mt-1 text-[10px] leading-none text-[color:var(--muted-foreground)]">
          {label}
        </div>
      </div>
    </div>
  );
};
