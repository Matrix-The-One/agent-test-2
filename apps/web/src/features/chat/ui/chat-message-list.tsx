import { useEffect, useRef } from "react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Bot, UserRound } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Streamdown, type PluginConfig } from "streamdown";

import {
  getClarificationMetadata,
  getMessageText,
} from "@/features/chat/lib/message-utils";
import type { ChatMessage } from "@/features/chat/model/types";
import { ClarificationCard } from "@/features/chat/ui/clarification-card";

const streamdownPlugins: PluginConfig = {
  cjk,
  code,
  math,
  mermaid,
};

type ChatMessageListProps = {
  isBusy: boolean;
  messages: ChatMessage[];
  onDraftSuggestion: (suggestion: string) => void;
  onSendSuggestion: (suggestion: string) => Promise<void>;
  status: string;
};

export function ChatMessageList({
  isBusy,
  messages,
  onDraftSuggestion,
  onSendSuggestion,
  status,
}: ChatMessageListProps) {
  const viewportRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    if (!messages.length) {
      return;
    }

    viewportRef.current?.scrollToIndex({
      align: "end",
      behavior: status === "ready" ? "smooth" : "auto",
      index: messages.length - 1,
    });
  }, [messages, status]);

  return (
    <div className="min-h-0 flex-1">
      <Virtuoso
        ref={viewportRef}
        alignToBottom
        className="h-full px-4 py-6 sm:px-6 xl:px-10"
        computeItemKey={(_, message) => message.id}
        components={{
          Footer: () => <div className="h-8" />,
        }}
        data={messages}
        itemContent={(_, message) => {
          const text = getMessageText(message);
          const clarification = getClarificationMetadata(message);

          if (!text && !clarification) {
            return <div className="hidden" />;
          }

          if (message.role === "user") {
            return (
              <div className="mx-auto w-full max-w-4xl py-4">
                <div className="ml-auto flex max-w-[88%] items-end gap-3">
                  <div className="rounded-[26px] bg-[color:var(--user-bubble)] px-5 py-4 text-sm leading-7 text-[color:var(--foreground)] shadow-[var(--shadow-soft)]">
                    {text}
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]">
                    <UserRound className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="mx-auto w-full max-w-4xl py-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--foreground)] text-white shadow-[var(--shadow-soft)]">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-[var(--shadow-soft)]">
                  {clarification ? (
                    <ClarificationCard
                      isBusy={isBusy}
                      onDraft={onDraftSuggestion}
                      onSend={onSendSuggestion}
                      question={text || "还需要你补充一点关键信息。"}
                      suggestions={clarification.suggestions ?? []}
                      title={clarification.title ?? "还需要确认一下"}
                    />
                  ) : (
                    <Streamdown isAnimating={status === "streaming"} plugins={streamdownPlugins}>
                      {text || "..."}
                    </Streamdown>
                  )}
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
