import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { sidebarActions } from "@/store/chat/sidebarData";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  ChatConversationRecord,
  ChatRequestMode,
  ConversationPreview,
} from "@/store/chat/types";
import { cn } from "@/lib/utils";

import { ChatConversationSearchDialog } from "./ChatConversationSearchDialog";

type ChatSidebarProps = {
  activeConversationId?: string;
  collapsed: boolean;
  conversations: ConversationPreview[];
  currentUserId?: string;
  defaultSearchConversations: ChatConversationRecord[];
  hasMoreConversations: boolean;
  isBusy: boolean;
  isLoadingConversations: boolean;
  onAction: (prompt: string, mode?: ChatRequestMode) => void;
  onCloseMobile: () => void;
  onCreateChat: () => void;
  onDeleteConversation: (conversationId: string) => Promise<void> | void;
  onLoadMoreConversations: () => Promise<void> | void;
  onOpenConversation: (conversationId: string) => Promise<void> | void;
  onRenameConversation: (
    conversationId: string,
    title: string,
  ) => Promise<void> | void;
};

export const ChatSidebar = ({
  activeConversationId,
  collapsed,
  conversations,
  currentUserId,
  defaultSearchConversations,
  hasMoreConversations,
  isBusy,
  isLoadingConversations,
  onAction,
  onCloseMobile,
  onCreateChat,
  onDeleteConversation,
  onLoadMoreConversations,
  onOpenConversation,
  onRenameConversation,
}: ChatSidebarProps) => {
  const isMobile = useIsMobile();
  const isCompact = collapsed && !isMobile;
  const [editingConversationId, setEditingConversationId] = useState<string | null>(
    null,
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    if (
      editingConversationId
      && !conversations.some((conversation) => conversation.id === editingConversationId)
    ) {
      setEditingConversationId(null);
      setRenameDraft("");
    }
  }, [conversations, editingConversationId]);

  const startRename = (conversation: ConversationPreview) => {
    setEditingConversationId(conversation.id);
    setRenameDraft(conversation.title);
  };

  const cancelRename = () => {
    setEditingConversationId(null);
    setRenameDraft("");
  };

  const submitRename = async (conversationId: string) => {
    const normalizedTitle = renameDraft.trim();

    if (!normalizedTitle) {
      window.alert("标题不能为空。");
      return;
    }

    try {
      await onRenameConversation(conversationId, normalizedTitle);
      cancelRename();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "重命名会话失败。",
      );
    }
  };

  const handleDelete = async (conversation: ConversationPreview) => {
    const confirmed = window.confirm(`确认删除“${conversation.title}”吗？`);

    if (!confirmed) {
      return;
    }

    try {
      await onDeleteConversation(conversation.id);
      if (editingConversationId === conversation.id) {
        cancelRename();
      }
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "删除会话失败。",
      );
    }
  };

  const handleSidebarAction = (
    actionId: string,
    prompt?: string,
    mode?: ChatRequestMode,
  ) => {
    if (actionId === "new-chat") {
      onCreateChat();
      return;
    }

    if (actionId === "search-chat") {
      setIsSearchOpen(true);
      return;
    }

    if (prompt) {
      onAction(prompt, mode);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex h-full min-h-0 flex-col bg-[color:var(--sidebar-bg)] py-3 backdrop-blur",
          isCompact ? "px-2" : "px-3",
        )}
      >
        <div
          className={cn(
            "flex items-center",
            isCompact ? "justify-center" : "justify-between px-2",
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-lg font-semibold text-[color:var(--foreground)] shadow-[var(--shadow-soft)]">
            C
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] transition hover:bg-black/4 lg:hidden"
            onClick={onCloseMobile}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            "mt-4",
            isCompact ? "space-y-2" : "space-y-1",
          )}
        >
          {sidebarActions.map((item) => {
            const Icon = item.icon;
            const isNewChat = item.id === "new-chat";

            return (
              <button
                key={item.id}
                aria-label={item.label}
                className={cn(
                  "flex text-sm text-[color:var(--foreground)] transition",
                  isNewChat
                    ? "bg-black/6 font-medium hover:bg-black/8"
                    : "hover:bg-black/4",
                  isCompact
                    ? "mx-auto h-11 w-11 items-center justify-center rounded-2xl px-0"
                    : "w-full items-center gap-3 rounded-2xl px-3 py-3 text-left",
                )}
                disabled={isBusy && isNewChat}
                onClick={() => handleSidebarAction(item.id, item.prompt, item.mode)}
                title={isCompact ? item.label : undefined}
                type="button"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {isCompact ? null : <span>{item.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-6 min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col">
            {isCompact ? (
              <div className="px-3">
                <div className="mx-auto h-px w-full rounded-full bg-[color:var(--border)]" />
              </div>
            ) : (
              <div className="flex items-center justify-between px-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  最近
                </p>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition hover:bg-black/4 hover:text-[color:var(--foreground)]"
                  onClick={() => setIsSearchOpen(true)}
                  type="button"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className={cn("min-h-0 flex-1", isCompact ? "mt-4" : "mt-3")}>
              {conversations.length === 0 ? (
                <div
                  className={cn(
                    "flex text-[color:var(--muted-foreground)]",
                    isCompact
                      ? "justify-center px-0 py-4"
                      : "items-center gap-2 px-3 py-4 text-sm",
                  )}
                >
                  {isLoadingConversations ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isCompact ? null : <span>正在加载会话...</span>}
                    </>
                  ) : (
                    isCompact ? <span className="text-xs">-</span> : <span>暂无已保存会话</span>
                  )}
                </div>
              ) : (
                <Virtuoso
                  className={cn("h-full", isCompact ? "" : "pr-1")}
                  computeItemKey={(_, item) => item.id}
                  data={conversations}
                  endReached={() => {
                    if (hasMoreConversations) {
                      void onLoadMoreConversations();
                    }
                  }}
                  itemContent={(_, item) => {
                    const isEditing = editingConversationId === item.id;

                    if (isCompact) {
                      return (
                        <div className="pb-2">
                          <button
                            aria-current={item.active ? "page" : undefined}
                            aria-label={item.title}
                            className={cn(
                              "mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border bg-[color:var(--surface)] text-sm font-medium text-[color:var(--foreground)] shadow-[var(--shadow-soft)] transition",
                              item.active
                                ? "border-[color:var(--foreground)]"
                                : "border-transparent hover:border-[color:var(--border)]",
                            )}
                            onClick={() => {
                              void onOpenConversation(item.id);
                            }}
                            title={`${item.title} · ${item.meta}`}
                            type="button"
                          >
                            <span className="max-w-[2ch] truncate">
                              {item.title.slice(0, 2)}
                            </span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="pb-1">
                        <div
                          className={cn(
                            "group rounded-2xl border bg-[color:var(--surface)] px-3 py-3 shadow-[var(--shadow-soft)] transition",
                            item.active
                              ? "border-[color:var(--foreground)]"
                              : "border-transparent hover:border-[color:var(--border)]",
                            isEditing ? "" : "cursor-pointer",
                          )}
                          onClick={() => {
                            if (!isEditing) {
                              void onOpenConversation(item.id);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (isEditing) {
                              return;
                            }

                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void onOpenConversation(item.id);
                            }
                          }}
                          role={isEditing ? undefined : "button"}
                          tabIndex={isEditing ? -1 : 0}
                        >
                          {isEditing ? (
                            <div className="flex min-w-0 items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <input
                                  autoFocus
                                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--foreground)]"
                                  maxLength={120}
                                  onChange={(event) => setRenameDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void submitRename(item.id);
                                    }

                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelRename();
                                    }
                                  }}
                                  value={renameDraft}
                                />
                                <p className="mt-2 px-1 text-xs text-[color:var(--muted-foreground)]">
                                  {item.meta}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                <button
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] transition hover:bg-black/4"
                                  onClick={() => {
                                    void submitRename(item.id);
                                  }}
                                  type="button"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] transition hover:bg-black/4"
                                  onClick={cancelRename}
                                  type="button"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                                  {item.meta}
                                </p>
                              </div>
                              {item.persisted ? (
                                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                  <button
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[color:var(--muted-foreground)] opacity-0 transition hover:border-[color:var(--border)] hover:bg-black/4 hover:text-[color:var(--foreground)] group-hover:opacity-100"
                                    disabled={isBusy}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      startRename(item);
                                    }}
                                    type="button"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[color:var(--muted-foreground)] opacity-0 transition hover:border-[color:var(--border)] hover:bg-black/4 hover:text-[color:var(--foreground)] group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-35"
                                    disabled={isBusy}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDelete(item);
                                    }}
                                    type="button"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
              )}
            </div>

            {conversations.length > 0 && isLoadingConversations ? (
              <div className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-[color:var(--muted-foreground)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>加载更多会话...</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ChatConversationSearchDialog
        activeConversationId={activeConversationId}
        currentUserId={currentUserId}
        defaultConversations={defaultSearchConversations}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectConversation={onOpenConversation}
      />
    </>
  );
};
