import { ArrowUp, Mic, Plus, Sparkles, Square } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

type ChatComposerProps = {
  draft: string;
  errorMessage?: string;
  helperText: string;
  isBusy: boolean;
  mode?: "docked" | "hero";
  onDraftChange: (value: string) => void;
  onStop: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  placeholder: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
};

export function ChatComposer({
  draft,
  errorMessage,
  helperText,
  isBusy,
  mode = "docked",
  onDraftChange,
  onStop,
  onSubmit,
  placeholder,
  textareaRef,
}: ChatComposerProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    event.preventDefault();

    if (!draft.trim() || isBusy) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form
      className={cn(
        "overflow-hidden rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-panel)]",
        mode === "hero" && "bg-[rgba(255,255,255,0.98)]",
      )}
      onSubmit={onSubmit}
    >
      <Textarea
        ref={textareaRef}
        className="min-h-[110px] border-0 bg-transparent px-5 py-5 text-base shadow-none focus:border-transparent"
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={draft}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] transition hover:bg-black/4"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--accent-soft)] px-3 py-2 text-sm text-[color:var(--accent-strong)] transition hover:brightness-[0.98]"
            type="button"
          >
            <Sparkles className="h-4 w-4" />
            进阶
          </button>
          <p
            className={cn(
              "hidden text-xs md:block",
              errorMessage ? "text-[color:var(--danger)]" : "text-[color:var(--muted-foreground)]",
            )}
          >
            {errorMessage ?? helperText}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isBusy ? (
            <Button onClick={onStop} size="icon" type="button" variant="ghost">
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] transition hover:bg-black/4"
              disabled
              type="button"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}

          <Button disabled={!draft.trim() || isBusy} size="icon" type="submit">
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-4 pb-4 text-xs text-[color:var(--muted-foreground)] md:hidden">
        {errorMessage ?? helperText}
      </div>
    </form>
  );
}
