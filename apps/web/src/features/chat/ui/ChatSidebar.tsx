import { ChevronRight, Search, X } from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { sidebarActions } from "@/features/chat/model/sidebarData";
import type {
  ChatRequestMode,
  ConversationPreview,
} from "@/features/chat/model/types";
import { cn } from "@/shared/lib/utils";

type ChatSidebarProps = {
  conversations: ConversationPreview[];
  onAction: (prompt: string, mode?: ChatRequestMode) => void;
  onCloseMobile: () => void;
  onCreateChat: () => void;
};

export const ChatSidebar = ({
  conversations,
  onAction,
  onCloseMobile,
  onCreateChat,
}: ChatSidebarProps) => {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--sidebar-bg)] px-3 py-3 backdrop-blur">
      <div className="flex items-center justify-between px-2">
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

      <div className="mt-4 space-y-1">
        {sidebarActions.map((item) => {
          const Icon = item.icon;
          const isNewChat = item.id === "new-chat";

          return (
            <button
              key={item.id}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-[color:var(--foreground)] transition",
                isNewChat
                  ? "bg-black/6 font-medium hover:bg-black/8"
                  : "hover:bg-black/4",
              )}
              onClick={() =>
                isNewChat ? onCreateChat() : item.prompt ? onAction(item.prompt, item.mode) : undefined
              }
              type="button"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between px-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              最近
            </p>
            <Search className="h-4 w-4 text-[color:var(--muted-foreground)]" />
          </div>

          <div className="mt-3 min-h-0 flex-1">
            <Virtuoso
              className="h-full pr-1"
              computeItemKey={(_, item) => item.id}
              data={conversations}
              itemContent={(_, item) => (
                <div className="pb-1">
                  <button
                    className={cn(
                      "group flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition",
                      item.active
                        ? "bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
                        : "hover:bg-black/4",
                    )}
                    onClick={() => item.prompt && onAction(item.prompt, item.mode)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                        {item.meta}
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)] opacity-0 transition",
                        item.active ? "opacity-100" : "group-hover:opacity-100",
                      )}
                    />
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
