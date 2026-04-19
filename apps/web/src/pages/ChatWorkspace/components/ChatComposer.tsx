import { useRef } from "react";
import { ArrowUp, Mic, Plus, Sparkles, Square, X } from "lucide-react";

import type { FileUIPart } from "ai";

import {
  CHAT_REQUEST_MODE_LABELS,
  type ChatAgentContextBudget,
  type ChatRequestMode,
} from "@/store/chat/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { ChatContextGauge } from "./ChatContextGauge";

type ChatComposerProps = {
  activeRequestMode?: ChatRequestMode | null;
  contextBudget: ChatAgentContextBudget | null;
  draft: string;
  errorMessage?: string;
  helperText: string;
  isBusy: boolean;
  mode?: "docked" | "hero";
  onClearRequestMode?: () => void;
  onDraftChange: (value: string) => void;
  onImageSelect: (files: FileList | null) => Promise<void> | void;
  onRemoveImage: (index: number) => void;
  onStop: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  pendingImages: FileUIPart[];
  placeholder: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
};

export const ChatComposer = ({
  activeRequestMode,
  contextBudget,
  draft,
  errorMessage,
  helperText,
  isBusy,
  mode = "docked",
  onClearRequestMode,
  onDraftChange,
  onImageSelect,
  onRemoveImage,
  onStop,
  onSubmit,
  pendingImages,
  placeholder,
  textareaRef,
}: ChatComposerProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const statusText = errorMessage ?? helperText;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    event.preventDefault();

    if ((!draft.trim() && pendingImages.length === 0) || isBusy) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form
      className={cn(
        "overflow-hidden rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-panel)]",
        mode === "hero" && "bg-[rgba(255,255,255,0.98)]",
      )}
      onSubmit={onSubmit}
    >
      <input
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        multiple
        onChange={(event) => {
          void onImageSelect(event.target.files);
          event.currentTarget.value = "";
        }}
        type="file"
      />

      {pendingImages.length > 0 ? (
        <div className="flex flex-wrap gap-3 px-5 pt-5">
          {pendingImages.map((image, index) => (
            <div
              key={`${image.url}-${index}`}
              className="relative h-20 w-20 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent-soft)]"
            >
              <img
                alt={image.filename ?? `upload-${index + 1}`}
                className="h-full w-full object-cover"
                src={image.url}
              />
              <button
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black/85"
                onClick={() => onRemoveImage(index)}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {activeRequestMode ? (
        <div className="px-5 pt-4">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-strong)] bg-[color:var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[color:var(--accent-strong)]"
            onClick={onClearRequestMode}
            type="button"
          >
            <Sparkles className="h-3.5 w-3.5" />
            按 {CHAT_REQUEST_MODE_LABELS[activeRequestMode]} 模式发送
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

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
          <Button
            className="rounded-full border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-none hover:bg-black/4"
            onClick={() => imageInputRef.current?.click()}
            size="icon-lg"
            type="button"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {statusText ? (
            <p
              className={cn(
                "hidden text-xs md:block",
                errorMessage ? "text-[color:var(--danger)]" : "text-[color:var(--muted-foreground)]",
              )}
            >
              {statusText}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <ChatContextGauge budget={contextBudget} isBusy={isBusy} />

          {isBusy ? (
            <Button
              className="rounded-full border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-none hover:bg-black/4"
              onClick={onStop}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              className="shrink-0 rounded-full border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-none hover:bg-black/4"
              disabled
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}

          <Button
            className="shrink-0 rounded-full"
            disabled={(!draft.trim() && pendingImages.length === 0) || isBusy}
            size="icon-lg"
            type="submit"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {statusText ? (
        <div
          className={cn(
            "px-4 pb-4 text-xs md:hidden",
            errorMessage ? "text-[color:var(--danger)]" : "text-[color:var(--muted-foreground)]",
          )}
        >
          {statusText}
        </div>
      ) : null}
    </form>
  );
};
