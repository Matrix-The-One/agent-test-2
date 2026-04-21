import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useAgentChatWorkspace } from "@/hooks/useAgentChatWorkspace";
import { ChatWorkspaceLayout } from "@/layouts/ChatWorkspaceLayout";
import { chatModeOptions, starterPrompts } from "@/store/chat/sidebarData";
import { buildConversationPreviews } from "@/utils/chat/conversationList";

import { ChatComposer } from "./components/ChatComposer";
import { ChatEmptyState } from "./components/ChatEmptyState";
import { ChatMessageList } from "./components/ChatMessageList";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatTopBar } from "./components/ChatTopBar";

export const ChatWorkspacePage = () => {
  const workspace = useAgentChatWorkspace();
  const [isComposerFullscreen, setComposerFullscreen] = useState(false);
  const conversations = buildConversationPreviews(
    workspace.savedConversations,
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
      ? ""
      : "输入一个需求，直接验证新的工作台布局与流式响应。";
  const composerErrorMessage = workspace.error?.message
    ? `请求失败：${workspace.error.message}`
    : undefined;

  useEffect(() => {
    requestAnimationFrame(() => {
      const textarea = workspace.draftRef.current;

      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }, [isComposerFullscreen, workspace.draftRef]);

  const renderComposer = (
    mode: "docked" | "hero" | "fullscreen",
  ) => (
    <ChatComposer
      activeRequestMode={workspace.selectedMode}
      contextBudget={workspace.latestAgentTrace?.contextBudget ?? null}
      draft={workspace.draft}
      errorMessage={composerErrorMessage}
      helperText={helperText}
      isBusy={workspace.isBusy}
      mode={mode}
      onClearRequestMode={workspace.handleClearMode}
      onDraftChange={workspace.setDraft}
      onImageSelect={workspace.handleImageSelection}
      onRemoveImage={workspace.handleRemovePendingImage}
      onStop={workspace.stop}
      onSubmit={workspace.handleSubmit}
      onToggleFullscreen={() => setComposerFullscreen((value) => !value)}
      pendingImages={workspace.pendingImages}
      placeholder={mode === "hero"
        ? activeModeOption?.placeholder ?? "给团队、代码库或 Agent 工作台发一条新需求"
        : activeModeOption?.placeholder ?? "继续描述你要做的 agent 能力、工作流或页面模块"}
      textareaRef={workspace.draftRef}
    />
  );

  return (
    <ChatWorkspaceLayout
      onCloseSidebar={() => workspace.setSidebarOpen(false)}
      sidebar={
        <ChatSidebar
          activeConversationId={workspace.chatId}
          collapsed={workspace.sidebarCollapsed}
          conversations={conversations}
          currentUserId={workspace.currentUser?.id}
          defaultSearchConversations={workspace.savedConversations}
          hasMoreConversations={workspace.savedConversationsHasMore}
          isBusy={workspace.isBusy}
          isLoadingConversations={workspace.isLoadingSavedConversations}
          onAction={(prompt, mode) => {
            void workspace.handleStarterPrompt(prompt, mode);
          }}
          onCloseMobile={() => workspace.setSidebarOpen(false)}
          onCreateChat={workspace.handleCreateChat}
          onDeleteConversation={(conversationId) => {
            void workspace.handleConversationDelete(conversationId);
          }}
          onRenameConversation={(conversationId, title) => {
            void workspace.handleConversationRename(conversationId, title);
          }}
          onLoadMoreConversations={() => {
            void workspace.loadMoreSavedConversations();
          }}
          onOpenConversation={(conversationId) => {
            void workspace.handleConversationSelect(conversationId);
          }}
        />
      }
      sidebarCollapsed={workspace.sidebarCollapsed}
      sidebarOpen={workspace.sidebarOpen}
    >
      <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[color:var(--main-surface)]">
        <ChatTopBar
          health={workspace.health}
          isSidebarCollapsed={workspace.sidebarCollapsed}
          onToggleSidebar={workspace.toggleSidebar}
          onToggleSidebarCollapsed={workspace.toggleSidebarCollapsed}
          status={workspace.status}
        />

        {workspace.hasConversation ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {workspace.isLoadingConversationMessages
              && workspace.deferredMessages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-4 py-12 text-sm text-[color:var(--muted-foreground)]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在加载会话内容...</span>
                  </div>
                </div>
              ) : (
                <ChatMessageList
                  isBusy={workspace.isBusy}
                  messages={workspace.deferredMessages}
                  onScrollingChange={workspace.setStreamingRenderPaused}
                  onDraftSuggestion={workspace.handleClarificationDraft}
                  onSendSuggestion={workspace.handleClarificationSuggestion}
                  status={workspace.status}
                />
              )}
            {isComposerFullscreen ? null : (
              <div className="border-t border-[color:var(--border)] bg-[color:var(--main-surface)]/96 px-4 py-4 backdrop-blur sm:px-6 xl:px-8">
                <div className="mx-auto max-w-4xl">
                  {renderComposer("docked")}
                </div>
              </div>
            )}
          </div>
        ) : (
          <ChatEmptyState
            activeMode={workspace.selectedMode}
            composer={isComposerFullscreen ? null : renderComposer("hero")}
            health={workspace.health}
            modeOptions={chatModeOptions}
            onModeSelect={workspace.handleModeSelect}
            onStarterPrompt={workspace.handleStarterPrompt}
            starterPrompts={starterPrompts}
          />
        )}

        {isComposerFullscreen ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 top-20 z-30 sm:inset-x-6 xl:inset-x-8">
            <div className="mx-auto h-full w-full max-w-5xl pointer-events-auto">
              {renderComposer("fullscreen")}
            </div>
          </div>
        ) : null}
      </div>
    </ChatWorkspaceLayout>
  );
};
