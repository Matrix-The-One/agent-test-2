import { memo, useEffect, useRef, type ReactNode } from "react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Virtuoso, type ItemProps, type VirtuosoHandle } from "react-virtuoso";
import { Streamdown, type PluginConfig } from "streamdown";

import {
  getClarificationMetadata,
  getMessageImageFiles,
  getMessageText,
} from "@/features/chat/lib/messageUtils";
import type { ChatMessage } from "@/features/chat/model/types";
import { ClarificationCard } from "@/features/chat/ui/ClarificationCard";

const streamdownPlugins: PluginConfig = {
  cjk,
  code,
  math,
  mermaid,
};

const trackClassName = "mx-auto w-full max-w-4xl";

type ChatMessageListProps = {
  isBusy: boolean;
  messages: ChatMessage[];
  onDraftSuggestion: (suggestion: string) => void;
  onSendSuggestion: (suggestion: string) => Promise<void>;
  scrollParent?: HTMLElement | null;
  status: string;
};

export const ChatMessageList = ({
  isBusy,
  messages,
  onDraftSuggestion,
  onSendSuggestion,
  scrollParent,
  status,
}: ChatMessageListProps) => {
  const viewportRef = useRef<VirtuosoHandle>(null);
  const previousUserMessageCountRef = useRef(0);
  const latestMessage = messages.at(-1);
  const latestAssistantMessageIndex = findLastMessageIndexByRole(messages, "assistant");
  const activeStreamingAssistantId = status === "streaming" && latestAssistantMessageIndex >= 0
    ? messages[latestAssistantMessageIndex]?.id
    : null;
  const showPendingAssistantFooter = isBusy && latestMessage?.role === "user";

  useEffect(() => {
    const userMessageCount = messages.filter((message) => message.role === "user").length;

    if (userMessageCount <= previousUserMessageCountRef.current) {
      previousUserMessageCountRef.current = userMessageCount;
      return;
    }

    const latestUserMessageIndex = [...messages]
      .map((message) => message.role)
      .lastIndexOf("user");

    if (latestUserMessageIndex < 0) {
      previousUserMessageCountRef.current = userMessageCount;
      return;
    }

    viewportRef.current?.scrollToIndex({
      align: "start",
      behavior: "smooth",
      index: latestUserMessageIndex,
    });

    previousUserMessageCountRef.current = userMessageCount;
  }, [messages.length]);

  return (
    <div className="min-w-0 px-4 sm:px-6 xl:px-8">
      <Virtuoso
        ref={viewportRef}
        className={scrollParent ? "py-6" : "h-full overflow-x-hidden py-6"}
        computeItemKey={(_, message) => message.id}
        components={{
          Footer: () => (
            <>
              {showPendingAssistantFooter ? (
                <div className="w-full py-4">
                  <div className={trackClassName}>
                    <AssistantMessageShell>
                      <AssistantLoadingIndicator />
                    </AssistantMessageShell>
                  </div>
                </div>
              ) : null}
              <div className="h-8" />
            </>
          ),
          Item: ({ children, style, ...props }: ItemProps<ChatMessage>) => (
            <div {...props} className="w-full" style={style}>
              {children}
            </div>
          ),
        }}
        customScrollParent={scrollParent ?? undefined}
        data={messages}
        itemContent={(_, message) => {
          const text = getMessageText(message);
          const imageFiles = getMessageImageFiles(message);
          const clarification = getClarificationMetadata(message);
          const isPendingAssistantMessage = message.role === "assistant"
            && !text
            && !clarification
            && imageFiles.length === 0
            && (status === "submitted" || status === "streaming");
          const isActiveStreamingMessage = message.id === activeStreamingAssistantId;

          if (!text && !clarification && imageFiles.length === 0 && !isPendingAssistantMessage) {
            return <div className="hidden" />;
          }

          if (message.role === "user") {
            return (
              <div className="w-full py-4">
                <div className={trackClassName}>
                  <div className="flex w-full justify-end">
                    <div className="max-w-[85%] sm:max-w-[72%] xl:max-w-3xl">
                      <div className="max-w-full rounded-[26px] bg-[color:var(--user-bubble)] px-5 py-4 text-sm leading-7 text-[color:var(--foreground)] shadow-[var(--shadow-soft)]">
                        {imageFiles.length > 0 ? (
                          <div className="mb-3 flex flex-wrap justify-end gap-3">
                            {imageFiles.map((file, index) => (
                              <img
                                key={`${file.url}-${index}`}
                                alt={file.filename ?? `upload-${index + 1}`}
                                className="h-28 w-28 rounded-2xl border border-white/40 object-cover"
                                src={file.url}
                              />
                            ))}
                          </div>
                        ) : null}
                        {text ? <div>{text}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="w-full py-4">
              <div className={trackClassName}>
                <AssistantMessageShell>
                  <div className="min-w-0">
                    {clarification ? (
                      <ClarificationCard
                        isBusy={isBusy}
                        onDraft={onDraftSuggestion}
                        onSend={onSendSuggestion}
                        question={text || "还需要你补充一点关键信息。"}
                        suggestions={clarification.suggestions ?? []}
                        title={clarification.title ?? "还需要确认一下"}
                      />
                    ) : isPendingAssistantMessage ? (
                      <AssistantLoadingIndicator />
                    ) : (
                      <AssistantMarkdown isAnimating={isActiveStreamingMessage} text={text} />
                    )}
                  </div>
                </AssistantMessageShell>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

const AssistantMarkdown = memo(({
  isAnimating,
  text,
}: {
  isAnimating: boolean;
  text: string;
}) => {
  return (
    <Streamdown isAnimating={isAnimating} plugins={streamdownPlugins}>
      {text}
    </Streamdown>
  );
});

const AssistantMessageShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-w-0 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-[var(--shadow-soft)]">
      {children}
    </div>
  );
};

const AssistantLoadingIndicator = () => {
  return (
    <div
      aria-label="Agent 正在生成回复"
      aria-live="polite"
      className="flex min-h-7 items-center gap-1.5"
      role="status"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2.5 w-2.5 rounded-full bg-[color:var(--muted-foreground)] opacity-60 animate-pulse"
          style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
        />
      ))}
    </div>
  );
};

const findLastMessageIndexByRole = (
  messages: ChatMessage[],
  role: ChatMessage["role"],
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === role) {
      return index;
    }
  }

  return -1;
};
