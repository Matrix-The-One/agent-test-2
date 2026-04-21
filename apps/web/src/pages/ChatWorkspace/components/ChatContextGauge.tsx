import { Gauge } from "lucide-react";

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
          className="relative shrink-0 rounded-full text-[color:var(--foreground)] shadow-none hover:bg-black/4"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <span className="relative flex h-8 w-8 items-center justify-center">
            <Gauge
              className={!budget && isBusy ? "animate-pulse" : undefined}
              style={{
                color: budget
                  ? gaugeColor
                  : "color-mix(in srgb, var(--primary) 45%, var(--muted-foreground))",
              }}
            />
            <span
              className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: budget
                  ? gaugeColor
                  : "color-mix(in srgb, var(--primary) 45%, transparent)",
              }}
            />
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
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/70 px-3 py-3">
              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]/75">
                <span>Usage</span>
                <span>{Math.round(usagePercent)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
                <div
                  className="h-full rounded-full transition-[width,background-color] duration-200"
                  style={{
                    backgroundColor: gaugeColor,
                    width: `${usagePercent}%`,
                  }}
                />
              </div>
            </div>
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
