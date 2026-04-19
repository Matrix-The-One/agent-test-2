import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import {
  getClarificationMetadata,
  getLatestUserMessageText,
  getMessageText,
} from "@/features/chat/lib/message-utils";
import type {
  ChatMessage,
  HealthState,
} from "@/features/chat/model/types";

export function useAgentChatWorkspace() {
  const [draft, setDraft] = useState("");
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const [health, setHealth] = useState<HealthState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/agent/stream",
        prepareSendMessagesRequest: ({ id, messages }) => {
          const message = getLatestUserMessageText(messages.at(-1));

          if (!message) {
            throw new Error("提交的消息为空。");
          }

          return {
            body: {
              message,
              threadId: id,
            },
          };
        },
      }),
  );
  const { error, messages, sendMessage, setMessages, status, stop } =
    useChat<ChatMessage>({
      id: chatId,
      transport,
    });

  const deferredMessages = useDeferredValue(messages);
  const isBusy = status === "submitted" || status === "streaming";
  const hasConversation = deferredMessages.length > 0;
  const lastAssistantMessage = deferredMessages
    .filter((message) => message.role === "assistant")
    .at(-1);
  const lastAssistantText = lastAssistantMessage
    ? getMessageText(lastAssistantMessage)
    : "";
  const awaitingClarification = Boolean(
    getClarificationMetadata(lastAssistantMessage),
  );

  useEffect(() => {
    void loadHealth();

    return () => {
      stop();
    };
  }, [stop]);

  async function loadHealth() {
    const response = await fetch("/api/health");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as HealthState;
    startTransition(() => {
      setHealth(data);
    });
  }

  async function sendPrompt(value: string) {
    const message = value.trim();

    if (!message || isBusy) {
      return;
    }

    try {
      setDraft("");
      setSidebarOpen(false);
      await sendMessage({ text: message });
    } catch {
      return;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendPrompt(draft);
  }

  async function handleClarificationSuggestion(suggestion: string) {
    await sendPrompt(suggestion);
  }

  async function handleStarterPrompt(prompt: string) {
    await sendPrompt(prompt);
  }

  function handleClarificationDraft(suggestion: string) {
    const nextDraft = suggestion.trim();

    if (!nextDraft || isBusy) {
      return;
    }

    setDraft(nextDraft);
    setSidebarOpen(false);

    requestAnimationFrame(() => {
      const textarea = draftRef.current;

      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }

  function handleCreateChat() {
    stop();
    setDraft("");
    setSidebarOpen(false);
    setMessages([]);
    setChatId(crypto.randomUUID());
  }

  function toggleSidebar() {
    setSidebarOpen((open) => !open);
  }

  return {
    awaitingClarification,
    chatId,
    deferredMessages,
    draft,
    draftRef,
    error,
    handleClarificationDraft,
    handleClarificationSuggestion,
    handleCreateChat,
    handleStarterPrompt,
    handleSubmit,
    hasConversation,
    health,
    isBusy,
    lastAssistantText,
    setDraft,
    setSidebarOpen,
    sidebarOpen,
    status,
    stop,
    toggleSidebar,
  };
}
