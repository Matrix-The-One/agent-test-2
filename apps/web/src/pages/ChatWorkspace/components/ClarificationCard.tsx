import { CircleHelp, PencilLine, SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/Button";

type ClarificationCardProps = {
  isBusy: boolean;
  onDraft: (suggestion: string) => void;
  onSend: (suggestion: string) => Promise<void>;
  question: string;
  suggestions: string[];
  title: string;
};

export const ClarificationCard = ({
  isBusy,
  onDraft,
  onSend,
  question,
  suggestions,
  title,
}: ClarificationCardProps) => {
  return (
    <div className="space-y-4 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]">
          <CircleHelp className="h-4 w-4" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            {title}
          </p>
          <p className="text-sm leading-7 text-[color:var(--foreground)]">{question}</p>
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion}
              className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3"
            >
              <p className="text-sm leading-6 text-[color:var(--foreground)]">
                {suggestion}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  className="h-9 px-3.5"
                  disabled={isBusy}
                  onClick={() => void onSend(suggestion)}
                  type="button"
                >
                  <SendHorizonal className="h-4 w-4" />
                  直接发送
                </Button>
                <Button
                  className="h-9 px-3.5"
                  disabled={isBusy}
                  onClick={() => onDraft(suggestion)}
                  type="button"
                  variant="secondary"
                >
                  <PencilLine className="h-4 w-4" />
                  写入输入框
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-[color:var(--border)] px-4 py-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          你也可以直接在下方输入框里补充更具体的目标、范围或限制条件。
        </div>
      )}
    </div>
  );
};
