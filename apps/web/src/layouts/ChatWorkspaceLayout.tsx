import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChatWorkspaceLayoutProps = {
  children: ReactNode;
  onCloseSidebar: () => void;
  sidebar: ReactNode;
  sidebarOpen: boolean;
};

export const ChatWorkspaceLayout = ({
  children,
  onCloseSidebar,
  sidebar,
  sidebarOpen,
}: ChatWorkspaceLayoutProps) => {
  return (
    <div className="h-dvh overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--foreground)]">
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/28 transition lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseSidebar}
      />

      <div className="h-full overflow-hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 h-dvh w-[280px] border-r border-[color:var(--border)] shadow-[var(--shadow-panel)] transition-transform duration-300 lg:static lg:z-auto lg:h-full lg:w-auto lg:translate-x-0 lg:shadow-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
        </aside>
        <main className="h-dvh min-w-0 overflow-hidden lg:h-full">{children}</main>
      </div>
    </div>
  );
};
