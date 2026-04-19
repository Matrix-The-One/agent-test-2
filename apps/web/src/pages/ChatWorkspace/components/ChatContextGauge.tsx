import {
  CHAT_AGENT_TOKEN_COUNTING_MODE_LABELS,
  type ChatAgentContextBudget,
} from "@/store/chat/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const compactionLabel = getCompactionLabel(budget);
  const usageLabel = budget
    ? `${formatTokenCount(budget.inputTokens)} / ${formatTokenCount(budget.maxConversationTokens)}`
    : "等待 token 预算";
  const accessibilityLabel = budget
    ? `上下文预算 ${budget.usagePercent}%`
    : "等待当前会话的上下文预算";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={accessibilityLabel}
          className="relative shrink-0 rounded-full border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-[var(--shadow-soft)] hover:scale-[1.02] hover:bg-[color:var(--surface)]/92"
          size="icon-lg"
          type="button"
          variant="outline"
        >
          <span className="relative h-10 w-10 shrink-0">
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
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
              {budget ? `${Math.round(usagePercent)}%` : "--"}
            </span>
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-72 rounded-[28px] border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-left shadow-[var(--shadow-panel)]"
        side="top"
        sideOffset={12}
      >
        <div className="flex items-start justify-between gap-3">
          <PopoverHeader className="gap-1">
            <PopoverDescription className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]/80">
              Context Budget
            </PopoverDescription>
            <PopoverTitle className="text-sm font-medium text-[color:var(--foreground)]">
              {budget ? `${budget.usagePercent}% 已使用` : "等待上下文预算"}
            </PopoverTitle>
          </PopoverHeader>
          <div
            className="rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={{
              backgroundColor: budget
                ? "color-mix(in srgb, var(--surface) 78%, transparent)"
                : "color-mix(in srgb, var(--accent-soft) 82%, transparent)",
              color: budget ? gaugeColor : "var(--muted-foreground)",
            }}
          >
            {budget ? formatTokenCount(budget.inputTokens) : "Pending"}
          </div>
        </div>

        {budget ? (
          <div className="mt-4 space-y-3 text-xs text-[color:var(--foreground)]">
            <GaugeMetaRow label="模型" value={budget.model} />
            <GaugeMetaRow label="窗口" value={usageLabel} />
            <GaugeMetaRow label="压缩" value={compactionLabel} />
            <GaugeMetaRow
              label="计数"
              value={CHAT_AGENT_TOKEN_COUNTING_MODE_LABELS[budget.countingMode]}
            />
          </div>
        ) : (
          <p className="mt-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
            {isBusy
              ? "消息还在生成，预算信息会在本轮 trace 到达后显示。"
              : "发送一条消息后，这里会显示当前线程的上下文预算与压缩状态。"}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
};

const GaugeMetaRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]/75">
        {label}
      </span>
      <span className="min-w-0 text-right text-[color:var(--foreground)]">
        {value}
      </span>
    </div>
  );
};
