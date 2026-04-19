import type { ReactNode } from "react";

import type { HealthState, ChatRequestMode } from "@/store/chat/types";
import type {
  ChatModeOption,
  StarterPrompt,
} from "@/store/chat/sidebarData";
import { cn } from "@/lib/utils";

type ChatEmptyStateProps = {
  activeMode: ChatRequestMode | null;
  composer: ReactNode;
  health: HealthState | null;
  modeOptions: ChatModeOption[];
  onModeSelect: (mode: ChatRequestMode) => void;
  onStarterPrompt: (prompt: string, mode?: ChatRequestMode) => Promise<void>;
  starterPrompts: StarterPrompt[];
};

export const ChatEmptyState = ({
  activeMode,
  composer,
  health,
  modeOptions,
  onModeSelect,
  onStarterPrompt,
  starterPrompts,
}: ChatEmptyStateProps) => {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full w-full items-center justify-center px-4 py-10 sm:px-6 xl:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="space-y-10 text-center">
            <div className="space-y-4">
              <p className="text-sm font-medium text-[color:var(--muted-foreground)]">
                ChatGPT 风格工作台
              </p>
              <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)] md:text-6xl">
                今天准备推进什么？
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-7 text-[color:var(--muted-foreground)] md:text-base">
                左侧整理对话与项目入口，右侧承载当前聊天、需求拆解和交互工作区。现在可以直接开始描述你要继续实现的模块。
              </p>
            </div>

            <div className="mx-auto max-w-3xl">{composer}</div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                快速模式
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {modeOptions.map((item) => (
                  <button
                    key={item.id}
                    className={cn(
                      "inline-flex items-center rounded-full border px-4 py-2.5 text-sm shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5",
                      activeMode === item.mode
                        ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-black/3",
                    )}
                    onClick={() => onModeSelect(item.mode)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {starterPrompts.map((item) => (
                <button
                  key={item.id}
                  className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--foreground)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-black/3"
                  onClick={() => void onStarterPrompt(item.prompt, item.mode)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-[color:var(--muted-foreground)]">
              {health?.providerConfigured
                ? `模型 ${health.model} 已连接，可继续流式对话`
                : "尚未检测到模型配置，请先确认后端环境变量"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
