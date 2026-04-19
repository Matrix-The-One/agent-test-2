import { useState } from "react";

import { buildConversationPreviews } from "@/features/chat/lib/conversationList";
import { chatModeOptions, starterPrompts } from "@/features/chat/model/sidebarData";
import { useAgentChatWorkspace } from "@/features/chat/model/useAgentChatWorkspace";
import { ChatComposer } from "@/features/chat/ui/ChatComposer";
import { ChatEmptyState } from "@/features/chat/ui/ChatEmptyState";
import { ChatMessageList } from "@/features/chat/ui/ChatMessageList";
import { ChatSidebar } from "@/features/chat/ui/ChatSidebar";
import { ChatTopBar } from "@/features/chat/ui/ChatTopBar";
import { ChatWorkspaceShell } from "@/widgets/chatShell/ui/ChatWorkspaceShell";

export const ChatWorkspacePage = () => {
  const workspace = useAgentChatWorkspace();
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  const conversations = buildConversationPreviews(
    workspace.deferredMessages,
    workspace.chatId,
  );
  const activeModeOption = workspace.selectedMode
    ? chatModeOptions.find((item) => item.mode === workspace.selectedMode)
    : undefined;
  const helperText = workspace.awaitingClarification
    ? "Agent 正在等待你补充关键上下文。"
    : activeModeOption
      ? activeModeOption.helperText
    : workspace.lastAssistantText
      ? "继续追问当前线程，回答会沿用已有上下文。"
      : "输入一个需求，直接验证新的工作台布局与流式响应。";

  return (
    <ChatWorkspaceShell
      onCloseSidebar={() => workspace.setSidebarOpen(false)}
      sidebar={
        <ChatSidebar
          conversations={conversations}
          onAction={(prompt, mode) => {
            void workspace.handleStarterPrompt(prompt, mode);
          }}
          onCloseMobile={() => workspace.setSidebarOpen(false)}
          onCreateChat={workspace.handleCreateChat}
        />
      }
      sidebarOpen={workspace.sidebarOpen}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[color:var(--main-surface)]">
        <ChatTopBar
          health={workspace.health}
          onToggleSidebar={workspace.toggleSidebar}
          status={workspace.status}
        />

        {workspace.hasConversation ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
              ref={setScrollParent}
              className="min-h-0 flex-1 overflow-y-auto"
              style={{ scrollbarGutter: "stable" }}
            >
              <div className="flex min-h-full flex-col">
                {scrollParent ? (
                  <ChatMessageList
                    isBusy={workspace.isBusy}
                    messages={workspace.deferredMessages}
                    onDraftSuggestion={workspace.handleClarificationDraft}
                    onSendSuggestion={workspace.handleClarificationSuggestion}
                    scrollParent={scrollParent}
                    status={workspace.status}
                  />
                ) : null}
                <div className="mt-auto sticky bottom-0 z-10 border-t border-[color:var(--border)] bg-[color:var(--main-surface)]/96 px-4 py-4 backdrop-blur sm:px-6 xl:px-8">
                  <div className="mx-auto max-w-4xl">
                    <ChatComposer
                      activeRequestMode={workspace.selectedMode}
                      draft={workspace.draft}
                      errorMessage={workspace.error?.message
                        ? `请求失败：${workspace.error.message}`
                        : undefined}
                      helperText={helperText}
                      isBusy={workspace.isBusy}
                      onClearRequestMode={workspace.handleClearMode}
                      onDraftChange={workspace.setDraft}
                      onImageSelect={workspace.handleImageSelection}
                      onRemoveImage={workspace.handleRemovePendingImage}
                      onStop={workspace.stop}
                      onSubmit={workspace.handleSubmit}
                      pendingImages={workspace.pendingImages}
                      placeholder={activeModeOption?.placeholder
                        ?? "继续描述你要做的 agent 能力、工作流或页面模块"}
                      textareaRef={workspace.draftRef}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ChatEmptyState
            activeMode={workspace.selectedMode}
            composer={
              <ChatComposer
                activeRequestMode={workspace.selectedMode}
                draft={workspace.draft}
                errorMessage={workspace.error?.message
                  ? `请求失败：${workspace.error.message}`
                  : undefined}
                helperText={helperText}
                isBusy={workspace.isBusy}
                mode="hero"
                onClearRequestMode={workspace.handleClearMode}
                onDraftChange={workspace.setDraft}
                onImageSelect={workspace.handleImageSelection}
                onRemoveImage={workspace.handleRemovePendingImage}
                onStop={workspace.stop}
                onSubmit={workspace.handleSubmit}
                pendingImages={workspace.pendingImages}
                placeholder={activeModeOption?.placeholder
                  ?? "给团队、代码库或 Agent 工作台发一条新需求"}
                textareaRef={workspace.draftRef}
              />
            }
            health={workspace.health}
            modeOptions={chatModeOptions}
            onModeSelect={workspace.handleModeSelect}
            onStarterPrompt={workspace.handleStarterPrompt}
            starterPrompts={starterPrompts}
          />
        )}
      </div>
    </ChatWorkspaceShell>
  );
};
