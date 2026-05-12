import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowDown } from "lucide-react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown, type PluginConfig } from "streamdown";

import { Button } from "@/components/ui/button";
import {
  getAgentTrace,
  getClarificationMetadata,
  getMessageImageFiles,
  getMessageText,
  getSkillChoiceMetadata,
} from "@/utils/chat/messageUtils";
import {
  CHAT_AGENT_TOKEN_COUNTING_MODE_LABELS,
  CHAT_REQUEST_MODE_LABELS,
  type ChatAgentTrace,
  type ChatAgentTraceExecutionMode,
  type ChatAgentTraceStepStatus,
  type ChatMessage,
  type ChatSkillChoiceMetadata,
  type ChatSkillChoiceOption,
} from "@/store/chat/types";

import { ClarificationCard } from "./ClarificationCard";
import { SkillChoiceCard } from "./SkillChoiceCard";

const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 80;
const PROGRAMMATIC_SCROLL_RESET_MS = 120;
const PROGRAMMATIC_SMOOTH_SCROLL_RESET_MS = 420;
const USER_SCROLL_IDLE_MS = 140;

const streamdownPlugins: PluginConfig = {
  cjk,
  code,
  math,
  mermaid,
};

const trackClassName = "mx-auto w-full max-w-4xl";
const traceExecutionModeLabels: Record<
  ChatAgentTraceExecutionMode,
  string
> = {
  "dynamic-supervisor": "动态调度",
  "fixed-chain": "固定链路",
  "image-placeholder": "图片占位",
};
const traceStepStatusLabels: Record<ChatAgentTraceStepStatus, string> = {
  completed: "已完成",
  planned: "待执行",
  running: "执行中",
};
const traceStepStatusClassNames: Record<ChatAgentTraceStepStatus, string> = {
  completed:
    "border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  planned:
    "border-slate-200/80 bg-slate-100/90 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
  running:
    "border-amber-200/80 bg-amber-50/90 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
};

type DisplayMessageItem = {
  key: string;
  message: ChatMessage;
};

const formatDuration = (durationMs: number | undefined) => {
  if (durationMs == null) {
    return "进行中";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  if (durationMs < 60_000) {
    const seconds = durationMs / 1000;

    return `${seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);

  return `${minutes}m ${seconds}s`;
};

const getStepStatusText = ({
  durationMs,
  status,
}: {
  durationMs?: number;
  status: ChatAgentTraceStepStatus;
}) => {
  if (status !== "completed") {
    return traceStepStatusLabels[status];
  }

  return `${traceStepStatusLabels[status]} · ${formatDuration(durationMs)}`;
};

const formatTokenCount = (value: number) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }

  return `${value}`;
};

const getContextBudgetSummary = (trace: ChatAgentTrace) => {
  if (!trace.contextBudget) {
    return "历史消息未记录";
  }

  return `${formatTokenCount(trace.contextBudget.inputTokens)} / ${formatTokenCount(trace.contextBudget.maxConversationTokens)} · ${trace.contextBudget.usagePercent}%`;
};

const getCompactionSummary = (trace: ChatAgentTrace) => {
  if (!trace.contextBudget) {
    return "历史消息未记录";
  }

  return trace.contextBudget.compaction.applied
    ? "本轮已自动压缩"
    : trace.contextBudget.compaction.active
      ? "已启用摘要压缩"
      : "未压缩";
};

const getCountingModeSummary = (trace: ChatAgentTrace) => {
  if (!trace.contextBudget) {
    return "历史消息未记录";
  }

  return CHAT_AGENT_TOKEN_COUNTING_MODE_LABELS[trace.contextBudget.countingMode];
};

type ChatMessageListProps = {
  isBusy: boolean;
  messages: ChatMessage[];
  onScrollingChange?: (isScrolling: boolean) => void;
  onDraftSuggestion: (suggestion: string) => void;
  onSendSuggestion: (suggestion: string) => Promise<void>;
  onSkillChoiceSelect: (
    choice: ChatSkillChoiceMetadata,
    option: ChatSkillChoiceOption,
  ) => Promise<void>;
  status: string;
  submittingSkillChoiceId: string | null;
};

export const ChatMessageList = ({
  isBusy,
  messages,
  onScrollingChange,
  onDraftSuggestion,
  onSendSuggestion,
  onSkillChoiceSelect,
  status,
  submittingSkillChoiceId,
}: ChatMessageListProps) => {
  const displayMessages = useMemo(() => mergeDisplayMessages(messages), [messages]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousUserMessageCountRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const isScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const scrollEndTimeoutRef = useRef<number | null>(null);
  const programmaticScrollTimeoutRef = useRef<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const latestMessage = displayMessages.at(-1)?.message;
  const latestAssistantMessageIndex = findLastMessageIndexByRole(
    displayMessages,
    "assistant",
  );
  const activeStreamingAssistantKey = status === "streaming" && latestAssistantMessageIndex >= 0
    ? displayMessages[latestAssistantMessageIndex]?.key
    : null;
  const showPendingAssistantFooter = isBusy && latestMessage?.role === "user";
  const showScrollToLatest = !isAtBottom && displayMessages.length > 0;

  const syncBottomState = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return false;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const nextIsAtBottom = distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;

    isAtBottomRef.current = nextIsAtBottom;
    setIsAtBottom((current) =>
      current === nextIsAtBottom ? current : nextIsAtBottom,
    );

    return nextIsAtBottom;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      isProgrammaticScrollRef.current = true;
      isAtBottomRef.current = true;
      setIsAtBottom(true);
      viewport.scrollTo({
        behavior,
        top: viewport.scrollHeight,
      });

      if (programmaticScrollTimeoutRef.current != null) {
        window.clearTimeout(programmaticScrollTimeoutRef.current);
      }

      programmaticScrollTimeoutRef.current = window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        syncBottomState();
      }, behavior === "smooth"
        ? PROGRAMMATIC_SMOOTH_SCROLL_RESET_MS
        : PROGRAMMATIC_SCROLL_RESET_MS);
    },
    [syncBottomState],
  );

  useLayoutEffect(() => {
    syncBottomState();
  }, [displayMessages.length, syncBottomState]);

  useEffect(() => {
    const userMessageCount = messages.filter((message) => message.role === "user").length;

    if (userMessageCount <= previousUserMessageCountRef.current) {
      previousUserMessageCountRef.current = userMessageCount;
      return;
    }

    const behavior =
      previousUserMessageCountRef.current === 0 ? "auto" : "smooth";

    scrollToBottom(behavior);
    previousUserMessageCountRef.current = userMessageCount;
  }, [messages, scrollToBottom]);

  useLayoutEffect(() => {
    if (!isAtBottomRef.current) {
      return;
    }

    scrollToBottom("auto");
  }, [displayMessages, scrollToBottom, status]);

  useEffect(() => {
    const content = contentRef.current;

    if (!content || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        scrollToBottom("auto");
      }
    });

    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, [scrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollEndTimeoutRef.current != null) {
        window.clearTimeout(scrollEndTimeoutRef.current);
      }

      if (programmaticScrollTimeoutRef.current != null) {
        window.clearTimeout(programmaticScrollTimeoutRef.current);
      }

      if (isScrollingRef.current) {
        isScrollingRef.current = false;
        onScrollingChange?.(false);
      }
    };
  }, [onScrollingChange]);

  useEffect(() => {
    if (!isBusy && isScrollingRef.current) {
      isScrollingRef.current = false;
      onScrollingChange?.(false);
    }
  }, [isBusy, onScrollingChange]);

  const handleScroll = () => {
    syncBottomState();

    if (isProgrammaticScrollRef.current || !isBusy) {
      return;
    }

    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      onScrollingChange?.(true);
    }

    if (scrollEndTimeoutRef.current != null) {
      window.clearTimeout(scrollEndTimeoutRef.current);
    }

    scrollEndTimeoutRef.current = window.setTimeout(() => {
      isScrollingRef.current = false;
      onScrollingChange?.(false);
      scrollEndTimeoutRef.current = null;
    }, USER_SCROLL_IDLE_MS);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={viewportRef}
        className="h-full overflow-y-auto px-4 sm:px-6 xl:px-8"
        onScroll={handleScroll}
        style={{ scrollbarGutter: "stable" }}
      >
        <div ref={contentRef} className="py-6">
          {displayMessages.map(({ key, message }) => {
            const text = getMessageText(message);
            const imageFiles = getMessageImageFiles(message);
            const clarification = getClarificationMetadata(message);
            const skillChoice = getSkillChoiceMetadata(message);
            const agentTrace = getAgentTrace(message);
            const isPendingAssistantMessage = message.role === "assistant"
              && !text
              && !clarification
              && !skillChoice
              && !agentTrace
              && imageFiles.length === 0
              && (status === "submitted" || status === "streaming");
            const isActiveStreamingMessage = key === activeStreamingAssistantKey;

            if (
              !text
              && !clarification
              && !skillChoice
              && !agentTrace
              && imageFiles.length === 0
              && !isPendingAssistantMessage
            ) {
              return null;
            }

            if (message.role === "user") {
              return (
                <div key={key} className="w-full py-4">
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
              <div key={key} className="w-full py-4">
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
                        <>
                          {skillChoice ? (
                            <SkillChoiceCard
                              canSelect={Boolean(skillChoice.choiceId)
                                && isActiveStreamingMessage
                                && (skillChoice.status ?? "pending") === "pending"}
                              choice={skillChoice}
                              isSubmitting={submittingSkillChoiceId === skillChoice.choiceId}
                              onSelect={onSkillChoiceSelect}
                            />
                          ) : null}
                          {text ? (
                            <div className={skillChoice ? "mt-4" : undefined}>
                              <AssistantMarkdown
                                isAnimating={isActiveStreamingMessage}
                                text={text}
                              />
                            </div>
                          ) : null}
                          {agentTrace ? (
                            <AgentTracePanel
                              isStreaming={isActiveStreamingMessage}
                              trace={agentTrace}
                            />
                          ) : null}
                          {!text
                          && isActiveStreamingMessage
                          && (!skillChoice || (skillChoice.status ?? "pending") !== "pending")
                          && (agentTrace || skillChoice) ? (
                            <div className="mt-4">
                              <AssistantLoadingIndicator />
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </AssistantMessageShell>
                </div>
              </div>
            );
          })}

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
        </div>
      </div>

      {showScrollToLatest ? (
        <Button
          aria-label="滚动到最新消息"
          className="absolute bottom-4 right-4 rounded-full shadow-[var(--shadow-panel)]"
          onClick={() => scrollToBottom("smooth")}
          size="icon-lg"
          type="button"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
};

const AgentTracePanel = ({
  isStreaming,
  trace,
}: {
  isStreaming: boolean;
  trace: ChatAgentTrace;
}) => {
  const executionModeLabel = traceExecutionModeLabels[trace.execution.executionMode];

  return (
    <details className="mt-4 overflow-hidden rounded-[22px] border border-[color:var(--border)]/80 bg-[color:var(--background)]/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs text-[color:var(--muted-foreground)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]/80">
            <span>Agent Trace</span>
            {isStreaming ? (
              <span className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                执行中
              </span>
            ) : null}
          </div>
          <div className="mt-1 truncate text-sm font-medium text-[color:var(--foreground)]">
            {CHAT_REQUEST_MODE_LABELS[trace.intent]} · {executionModeLabel}
          </div>
        </div>
        <div className="text-right text-[11px] text-[color:var(--muted-foreground)]">
          <div>{formatDuration(trace.totalDurationMs)}</div>
          <div>{trace.execution.responder.model}</div>
        </div>
      </summary>
      <div className="space-y-4 border-t border-[color:var(--border)]/70 px-4 py-4 text-xs leading-6">
        <div className="grid gap-2 sm:grid-cols-2">
          <TraceMetaItem
            label="总耗时"
            value={formatDuration(trace.totalDurationMs)}
          />
          <TraceMetaItem
            label="路由耗时"
            value={formatDuration(trace.routingDurationMs)}
          />
          <TraceMetaItem
            label="意图判断"
            value={trace.routing.intentReason}
          />
          <TraceMetaItem
            label="图片角色"
            value={trace.routing.imageRoleReason}
          />
          <TraceMetaItem
            label="技能路由"
            value={trace.routing.skillSelectionReason}
          />
          <TraceMetaItem
            label="上下文预算"
            value={getContextBudgetSummary(trace)}
          />
          <TraceMetaItem
            label="自动压缩"
            value={getCompactionSummary(trace)}
          />
          <TraceMetaItem
            label="计数模式"
            value={getCountingModeSummary(trace)}
          />
          <TraceMetaItem
            label="执行器"
            value={`${trace.execution.responder.label} · ${trace.execution.responder.model}`}
          />
        </div>
        {trace.execution.availableSpecialists.length > 0 ? (
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]/80">
              Specialists
            </div>
            <div className="flex flex-wrap gap-2">
              {trace.execution.availableSpecialists.map((specialist) => (
                <div
                  key={`${specialist.category}-${specialist.model}`}
                  className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-[11px] text-[color:var(--foreground)]"
                >
                  {specialist.label} · {specialist.model}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {trace.execution.steps.length > 0 ? (
          <div className="space-y-3">
            {trace.execution.steps.map((step) => (
              <div
                key={step.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[color:var(--foreground)]">
                      {step.title}
                    </div>
                    <div className="mt-1 break-all text-[11px] text-[color:var(--muted-foreground)]">
                      {step.model}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${traceStepStatusClassNames[step.status]}`}
                  >
                    {getStepStatusText(step)}
                  </span>
                </div>
                {step.task ? (
                  <p className="mt-3 text-[color:var(--muted-foreground)]">
                    任务：{step.task}
                  </p>
                ) : null}
                {step.expectedOutput ? (
                  <p className="mt-2 text-[color:var(--muted-foreground)]">
                    期望输出：{step.expectedOutput}
                  </p>
                ) : null}
                {step.summary ? (
                  <p className="mt-2 text-[color:var(--foreground)]">
                    摘要：{step.summary}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
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

const TraceMetaItem = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]/80">
        {label}
      </div>
      <div className="mt-1 text-[color:var(--foreground)]">{value}</div>
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
  messages: DisplayMessageItem[],
  role: ChatMessage["role"],
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.message.role === role) {
      return index;
    }
  }

  return -1;
};

const mergeDisplayMessages = (messages: ChatMessage[]) => {
  const mergedMessages: DisplayMessageItem[] = [];
  let pendingTraceMessage: ChatMessage | null = null;

  for (const message of messages) {
    if (message.role !== "assistant") {
      if (pendingTraceMessage) {
        mergedMessages.push({
          key: pendingTraceMessage.id,
          message: pendingTraceMessage,
        });
        pendingTraceMessage = null;
      }

      mergedMessages.push({
        key: message.id,
        message,
      });
      continue;
    }

    if (isTraceOnlyAssistantMessage(message)) {
      pendingTraceMessage = message;
      continue;
    }

    if (!pendingTraceMessage) {
      mergedMessages.push({
        key: message.id,
        message,
      });
      continue;
    }

    mergedMessages.push(mergeAssistantTraceMessage(pendingTraceMessage, message));
    pendingTraceMessage = null;
  }

  if (pendingTraceMessage) {
    mergedMessages.push({
      key: pendingTraceMessage.id,
      message: pendingTraceMessage,
    });
  }

  return mergedMessages;
};

const isTraceOnlyAssistantMessage = (message: ChatMessage) => {
  return message.role === "assistant"
    && Boolean(getAgentTracePart(message))
    && !getMessageText(message)
    && !getClarificationMetadata(message)
    && !getSkillChoiceMetadata(message)
    && getMessageImageFiles(message).length === 0;
};

const mergeAssistantTraceMessage = (
  traceMessage: ChatMessage,
  message: ChatMessage,
): DisplayMessageItem => {
  const tracePart = getAgentTracePart(traceMessage);

  if (!tracePart || getAgentTracePart(message)) {
    return {
      key: traceMessage.id,
      message,
    };
  }

  return {
    key: traceMessage.id,
    message: {
      ...message,
      ...(message.metadata
        ? {}
        : traceMessage.metadata
          ? { metadata: traceMessage.metadata }
          : {}),
      parts: [
        ...message.parts,
        {
          data: tracePart.data,
          id: tracePart.id,
          type: tracePart.type,
        },
      ],
    },
  };
};

const getAgentTracePart = (message: ChatMessage | undefined) => {
  if (!message || message.role !== "assistant") {
    return null;
  }

  return [...message.parts].reverse().find(
    (
      part,
    ): part is Extract<(typeof message.parts)[number], { type: "data-agentTrace" }> =>
      part.type === "data-agentTrace",
  ) ?? null;
};
