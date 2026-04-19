import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";

import { listChatConversations } from "@/services/chat/chatApi";
import { chatQueryKeys } from "@/services/chat/queryKeys";
import type {
  ChatConversationListPage,
  ChatConversationRecord,
} from "@/store/chat/types";
import { cn } from "@/lib/utils";

const SEARCH_PAGE_SIZE = 20;

const flattenSearchPages = (pages: ChatConversationListPage[] | undefined) =>
  pages?.flatMap((page) => page.items) ?? [];

const formatConversationMeta = (conversation: ChatConversationRecord) => {
  const updatedAt = new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
  }).format(new Date(conversation.updatedAt));

  return `${conversation.messageCount} 条消息 · ${updatedAt}`;
};

type ChatConversationSearchDialogProps = {
  activeConversationId?: string;
  currentUserId?: string;
  defaultConversations: ChatConversationRecord[];
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (
    conversationId: string,
  ) => Promise<void> | void;
};

export const ChatConversationSearchDialog = ({
  activeConversationId,
  currentUserId,
  defaultConversations,
  isOpen,
  onClose,
  onSelectConversation,
}: ChatConversationSearchDialogProps) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectingConversationId, setSelectingConversationId] = useState<
    string | null
  >(null);
  const [selectionErrorMessage, setSelectionErrorMessage] = useState<
    string | null
  >(null);
  const normalizedQuery = debouncedQuery.trim();
  const isSearching = normalizedQuery.length > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsQuery = useInfiniteQuery<ChatConversationListPage>({
    enabled: isOpen && Boolean(currentUserId),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listChatConversations(currentUserId!, {
        cursor: pageParam as string | undefined,
        limit: SEARCH_PAGE_SIZE,
        query: normalizedQuery || undefined,
      }),
    queryKey: chatQueryKeys.conversationSearch(
      currentUserId ?? "anonymous",
      normalizedQuery,
    ),
  });
  const results = flattenSearchPages(searchResultsQuery.data?.pages);
  const displayResults = isSearching
    ? results
    : results.length > 0
      ? results
      : defaultConversations;
  const errorMessage = selectionErrorMessage
    ?? (searchResultsQuery.error instanceof Error
      ? searchResultsQuery.error.message
      : null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setSelectingConversationId(null);
      setSelectionErrorMessage(null);
      return;
    }

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const debounceTimer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSelect = async (conversationId: string) => {
    if (selectingConversationId) {
      return;
    }

    setSelectingConversationId(conversationId);
    setSelectionErrorMessage(null);

    try {
      await onSelectConversation(conversationId);
      onClose();
    } catch (error) {
      setSelectionErrorMessage(
        error instanceof Error ? error.message : "打开会话失败。",
      );
    } finally {
      setSelectingConversationId(null);
    }
  };

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const handleResultsScroll = (
    event: React.UIEvent<HTMLDivElement>,
  ) => {
    if (
      !searchResultsQuery.hasNextPage
      || searchResultsQuery.isFetchingNextPage
    ) {
      return;
    }

    const target = event.currentTarget;
    const remainingScrollDistance =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    if (remainingScrollDistance <= 96) {
      void searchResultsQuery.fetchNextPage();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/36 px-4 py-10 backdrop-blur-sm sm:px-6">
      <button
        aria-label="关闭搜索会话弹窗"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />

      <div className="relative z-10 flex max-h-[min(78dvh,720px)] w-full max-w-3xl min-h-[420px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[color:var(--main-surface)] shadow-[var(--shadow-panel)]">
        <div className="flex items-center gap-3 border-b border-[color:var(--border)] px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted-foreground)]">
            <Search className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              搜索会话
            </p>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              输入标题关键字，点击结果后直接定位到目标会话
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] transition hover:bg-black/4 hover:text-[color:var(--foreground)]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[color:var(--border)] px-5 py-4">
          <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
            <Search className="h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
            <input
              ref={searchInputRef}
              className="w-full bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索历史会话标题"
              value={query}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 px-3 py-3">
          {errorMessage ? (
            <div className="px-3 pb-3 text-sm text-[color:var(--destructive)]">
              {errorMessage}
            </div>
          ) : null}

          {!currentUserId ? (
            <div className="flex h-full items-center justify-center px-4 text-sm text-[color:var(--muted-foreground)]">
              正在初始化会话用户...
            </div>
          ) : searchResultsQuery.isPending && displayResults.length === 0 ? (
            <div className="flex h-full items-center justify-center gap-2 px-4 text-sm text-[color:var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在加载会话...</span>
            </div>
          ) : displayResults.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-sm text-[color:var(--muted-foreground)]">
              {isSearching ? "没有找到匹配的会话" : "暂无历史会话"}
            </div>
          ) : (
            <div
              className="h-full overflow-y-auto px-2"
              onScroll={handleResultsScroll}
            >
              <div className="space-y-2">
                {displayResults.map((item) => {
                const isActive = item.id === activeConversationId;
                const isSelecting = selectingConversationId === item.id;

                return (
                  <div key={item.id}>
                    <button
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                        isActive
                          ? "border-[color:var(--foreground)] bg-[color:var(--surface)]"
                          : "border-transparent bg-[color:var(--surface)] hover:border-[color:var(--border)]",
                        isSelecting ? "opacity-70" : "",
                      )}
                      disabled={Boolean(selectingConversationId)}
                      onClick={() => {
                        void handleSelect(item.id);
                      }}
                      type="button"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--main-surface)] text-[color:var(--muted-foreground)]">
                        {isSelecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                          {formatConversationMeta(item)}
                        </p>
                      </div>
                    </button>
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </div>

        {displayResults.length > 0 && searchResultsQuery.isFetchingNextPage ? (
          <div className="flex items-center justify-center gap-2 border-t border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>加载更多会话...</span>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};
