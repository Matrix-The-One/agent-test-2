import { buildConversationPreviews } from "@/features/chat/lib/conversation-list";
import { starterPrompts } from "@/features/chat/model/sidebar-data";
import { useAgentChatWorkspace } from "@/features/chat/model/use-agent-chat-workspace";
import { ChatComposer } from "@/features/chat/ui/chat-composer";
import { ChatEmptyState } from "@/features/chat/ui/chat-empty-state";
import { ChatMessageList } from "@/features/chat/ui/chat-message-list";
import { ChatSidebar } from "@/features/chat/ui/chat-sidebar";
import { ChatTopBar } from "@/features/chat/ui/chat-top-bar";
import { ChatWorkspaceShell } from "@/widgets/chat-shell/ui/chat-workspace-shell";

export function ChatWorkspacePage() {
  const workspace = useAgentChatWorkspace();
  const conversations = buildConversationPreviews(
    workspace.deferredMessages,
    workspace.chatId,
  );
  const helperText = workspace.awaitingClarification
    ? "Agent 正在等待你补充关键上下文。"
    : workspace.lastAssistantText
      ? "继续追问当前线程，回答会沿用已有上下文。"
      : "输入一个需求，直接验证新的工作台布局与流式响应。";

  return (
    <ChatWorkspaceShell
      onCloseSidebar={() => workspace.setSidebarOpen(false)}
      sidebar={
        <ChatSidebar
          conversations={conversations}
          onAction={workspace.handleClarificationDraft}
          onCloseMobile={() => workspace.setSidebarOpen(false)}
          onCreateChat={workspace.handleCreateChat}
        />
      }
      sidebarOpen={workspace.sidebarOpen}
    >
      <div className="flex h-full min-h-0 flex-col bg-[color:var(--main-surface)]">
        <ChatTopBar
          health={workspace.health}
          onToggleSidebar={workspace.toggleSidebar}
          status={workspace.status}
        />

        {workspace.hasConversation ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatMessageList
              isBusy={workspace.isBusy}
              messages={workspace.deferredMessages}
              onDraftSuggestion={workspace.handleClarificationDraft}
              onSendSuggestion={workspace.handleClarificationSuggestion}
              status={workspace.status}
            />
            <div className="shrink-0 border-t border-[color:var(--border)] px-4 py-4 sm:px-6 xl:px-8">
              <div className="mx-auto max-w-4xl">
                <ChatComposer
                  draft={workspace.draft}
                  errorMessage={workspace.error?.message
                    ? `请求失败：${workspace.error.message}`
                    : undefined}
                  helperText={helperText}
                  isBusy={workspace.isBusy}
                  onDraftChange={workspace.setDraft}
                  onStop={workspace.stop}
                  onSubmit={workspace.handleSubmit}
                  placeholder="继续描述你要做的 agent 能力、工作流或页面模块"
                  textareaRef={workspace.draftRef}
                />
              </div>
            </div>
          </div>
        ) : (
          <ChatEmptyState
            composer={
              <ChatComposer
                draft={workspace.draft}
                errorMessage={workspace.error?.message
                  ? `请求失败：${workspace.error.message}`
                  : undefined}
                helperText={helperText}
                isBusy={workspace.isBusy}
                mode="hero"
                onDraftChange={workspace.setDraft}
                onStop={workspace.stop}
                onSubmit={workspace.handleSubmit}
                placeholder="给团队、代码库或 Agent 工作台发一条新需求"
                textareaRef={workspace.draftRef}
              />
            }
            health={workspace.health}
            onStarterPrompt={workspace.handleStarterPrompt}
            starterPrompts={starterPrompts}
          />
        )}
      </div>
    </ChatWorkspaceShell>
  );
}
