import {
  ChevronDown,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";

import type { HealthState } from "@/store/chat/types";

type ChatTopBarProps = {
  health: HealthState | null;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onToggleSidebarCollapsed: () => void;
  status: string;
};

export const ChatTopBar = ({
  health,
  isSidebarCollapsed,
  onToggleSidebar,
  onToggleSidebarCollapsed,
  status,
}: ChatTopBarProps) => {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--main-surface)]/92 px-4 backdrop-blur sm:px-6 xl:px-8">
      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-[var(--shadow-soft)] transition hover:bg-black/4 lg:hidden"
          onClick={onToggleSidebar}
          type="button"
        >
          <Menu className="h-4 w-4" />
        </button>
        <button
          aria-label={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-[var(--shadow-soft)] transition hover:bg-black/4 lg:inline-flex"
          onClick={onToggleSidebarCollapsed}
          type="button"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        <button className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] shadow-[var(--shadow-soft)]">
          ChatGPT
          <ChevronDown className="h-4 w-4 text-[color:var(--muted-foreground)]" />
        </button>

        <div className="hidden items-center gap-2 text-xs text-[color:var(--muted-foreground)] sm:flex">
          <span
            className="inline-flex h-2 w-2 rounded-full"
            style={{
              backgroundColor: health?.providerConfigured
                ? "var(--primary)"
                : "var(--destructive)",
            }}
          />
          <span>{status === "ready" ? "工作台已就绪" : status}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--muted-foreground)] shadow-[var(--shadow-soft)] md:flex">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-strong)]" />
          <span>{health?.memoryEnabled ? "线程记忆已开启" : "线程记忆未开启"}</span>
        </div>
        <div className="hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--muted-foreground)] shadow-[var(--shadow-soft)] lg:block">
          {health?.model ?? "等待模型配置"}
        </div>
      </div>
    </header>
  );
};
