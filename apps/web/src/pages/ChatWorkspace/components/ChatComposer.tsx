import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Maximize2,
  Mic,
  Minimize2,
  Plus,
  Sparkles,
  Square,
  X,
} from "lucide-react";

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
  mode?: "docked" | "hero" | "fullscreen";
  onClearRequestMode?: () => void;
  onDraftChange: (value: string) => void;
  onImageSelect: (files: FileList | null) => Promise<void> | void;
  onRemoveImage: (index: number) => void;
  onStop: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onToggleFullscreen?: () => void;
  pendingImages: FileUIPart[];
  placeholder: string;
  textareaRef?: { current: HTMLTextAreaElement | null };
};

const TEXTAREA_MIN_HEIGHT = 136;
const TEXTAREA_MAX_HEIGHT = 320;

const hasImageFile = (file: File) => file.type.startsWith("image/");

const hasTransferFiles = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer) {
    return false;
  }

  return dataTransfer.files.length > 0
    || Array.from(dataTransfer.items).some((item) => item.kind === "file");
};

const hasTransferImages = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.files).some(hasImageFile)
    || Array.from(dataTransfer.items).some(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
};

const getImageFileListFromTransfer = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer) {
    return null;
  }

  const imageFiles = Array.from(dataTransfer.files).filter(hasImageFile);

  if (imageFiles.length === 0) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) {
        continue;
      }

      const file = item.getAsFile();

      if (file) {
        imageFiles.push(file);
      }
    }
  }

  if (imageFiles.length === 0) {
    return null;
  }

  const nextTransfer = new DataTransfer();

  for (const file of imageFiles) {
    nextTransfer.items.add(file);
  }

  return nextTransfer.files;
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
  onToggleFullscreen,
  pendingImages,
  placeholder,
  textareaRef,
}: ChatComposerProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragDepthRef = useRef(0);
  const [isDraggingImage, setDraggingImage] = useState(false);
  const statusText = errorMessage ?? helperText;
  const isFullscreen = mode === "fullscreen";

  const syncTextareaHeight = useCallback(() => {
    const textarea = localTextareaRef.current;

    if (!textarea) {
      return;
    }

    if (isFullscreen) {
      textarea.style.height = "100%";
      textarea.style.overflowY = "auto";
      return;
    }

    const minHeight = TEXTAREA_MIN_HEIGHT;
    const maxHeight = TEXTAREA_MAX_HEIGHT;

    textarea.style.height = `${minHeight}px`;

    const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [isFullscreen]);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [activeRequestMode, draft, pendingImages.length, syncTextareaHeight]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("resize", syncTextareaHeight);
    return () => {
      window.removeEventListener("resize", syncTextareaHeight);
    };
  }, [syncTextareaHeight]);

  const handleTextareaRef = (node: HTMLTextAreaElement | null) => {
    localTextareaRef.current = node;

    if (textareaRef) {
      textareaRef.current = node;
    }
  };

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

  const resetDragState = () => {
    dragDepthRef.current = 0;
    setDraggingImage(false);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!hasTransferImages(event.clipboardData)) {
      return;
    }

    void onImageSelect(getImageFileListFromTransfer(event.clipboardData));
  };

  const handleDragEnter = (event: React.DragEvent<HTMLFormElement>) => {
    if (!hasTransferFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;

    if (hasTransferImages(event.dataTransfer)) {
      setDraggingImage(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLFormElement>) => {
    if (!hasTransferFiles(event.dataTransfer) && dragDepthRef.current === 0) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setDraggingImage(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLFormElement>) => {
    if (!hasTransferFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";

    if (hasTransferImages(event.dataTransfer)) {
      setDraggingImage(true);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLFormElement>) => {
    if (!hasTransferFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();

    const imageFiles = getImageFileListFromTransfer(event.dataTransfer);

    resetDragState();
    void onImageSelect(imageFiles);
  };

  return (
    <form
      className={cn(
        "relative overflow-hidden rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-panel)] transition-[border-color,background-color,box-shadow]",
        mode === "hero" && "bg-[rgba(255,255,255,0.98)]",
        isFullscreen
          && "flex h-full max-h-full flex-col rounded-[34px] bg-[rgba(255,255,255,0.99)] shadow-[0_30px_90px_rgba(15,23,42,0.14)]",
        isDraggingImage
          && "border-[color:var(--accent-strong)] bg-[color:var(--accent-soft)] shadow-[0_0_0_1px_var(--accent-strong)]",
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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

      {isDraggingImage ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex p-3">
          <div className="flex flex-1 items-center justify-center rounded-[26px] border-2 border-dashed border-[color:var(--accent-strong)] bg-[color:var(--surface)] text-sm font-medium text-[color:var(--accent-strong)] backdrop-blur-sm">
            松开即可添加图片
          </div>
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

      <div className={cn("px-5 pt-4", isFullscreen && "flex min-h-0 flex-1 pb-4")}>
        <Textarea
          ref={handleTextareaRef}
          className={cn(
            "min-h-0 resize-none border-0 bg-transparent px-0 py-0 text-base leading-7 shadow-none focus:border-transparent focus-visible:ring-0",
            isFullscreen ? "h-full max-h-none text-[1.02rem]" : "",
          )}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={1}
          value={draft}
        />
      </div>

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
          {onToggleFullscreen ? (
            <Button
              aria-label={isFullscreen ? "退出撰写全屏" : "进入撰写全屏"}
              className="rounded-full border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-none hover:bg-black/4"
              onClick={onToggleFullscreen}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          {contextBudget ? (
            <ChatContextGauge budget={contextBudget} isBusy={isBusy} />
          ) : null}

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
