import {
  CheckCircle2,
  Clock3,
  ListChecks,
  MousePointerClick,
} from "lucide-react";

import type { ChatSkillChoiceMetadata, ChatSkillChoiceOption } from "@/store/chat/types";
import { cn } from "@/lib/utils";

type SkillChoiceCardProps = {
  canSelect: boolean;
  choice: ChatSkillChoiceMetadata;
  isSubmitting: boolean;
  onSelect: (
    choice: ChatSkillChoiceMetadata,
    option: ChatSkillChoiceOption,
  ) => Promise<void>;
};

export const SkillChoiceCard = ({
  canSelect,
  choice,
  isSubmitting,
  onSelect,
}: SkillChoiceCardProps) => {
  const status = choice.status ?? "pending";
  const statusText = status === "selected"
    ? "已选择"
    : status === "expired"
      ? "已超时"
      : "等待选择";

  return (
    <div className="space-y-4 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]">
          <ListChecks className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            {choice.title}
          </p>
          <p className="text-sm leading-7 text-[color:var(--foreground)]">
            {choice.question}
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs text-[color:var(--muted-foreground)]">
            <Clock3 className="h-3.5 w-3.5" />
            {statusText}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {choice.options.map((option) => {
          const isSelected = choice.selectedOptionId === option.id;
          const isDisabled = !canSelect || isSubmitting || status !== "pending";

          return (
            <button
              key={option.id}
              className={cn(
                "group w-full rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-left transition hover:border-[color:var(--accent-strong)]/50 hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  && "border-[color:var(--accent-strong)] bg-[color:var(--accent-soft)]",
              )}
              disabled={isDisabled}
              onClick={() => void onSelect(choice, option)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[color:var(--foreground)]">
                    {option.label}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {option.description}
                  </p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-[color:var(--accent-foreground)] transition group-disabled:opacity-60">
                  {isSelected ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <MousePointerClick className="h-4 w-4" />
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
