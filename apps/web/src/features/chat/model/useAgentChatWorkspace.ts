import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { convertFileListToFileUIParts, DefaultChatTransport, type FileUIPart } from "ai";

import {
  getClarificationMetadata,
  getMessageImageFiles,
  getLatestUserMessageText,
  getMessageText,
} from "@/features/chat/lib/messageUtils";
import type {
  ChatMessage,
  ChatRequestImage,
  ChatRequestMode,
  HealthState,
} from "@/features/chat/model/types";

export const useAgentChatWorkspace = () => {
  const [draft, setDraft] = useState("");
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const [health, setHealth] = useState<HealthState | null>(null);
  const [pendingImages, setPendingImages] = useState<FileUIPart[]>([]);
  const [selectedMode, setSelectedModeState] = useState<ChatRequestMode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const selectedModeRef = useRef<ChatRequestMode | null>(null);
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/agent/stream",
        prepareSendMessagesRequest: ({ id, messages }) => {
          const latestMessage = messages.at(-1);
          const message = getLatestUserMessageText(latestMessage);
          const images: ChatRequestImage[] = getMessageImageFiles(latestMessage).map(
            (file) => ({
              filename: file.filename,
              mediaType: file.mediaType,
              url: file.url,
            }),
          );

          if (!message && images.length === 0) {
            throw new Error("提交的消息为空。");
          }

          return {
            body: {
              images,
              message,
              mode: selectedModeRef.current ?? undefined,
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

  const focusDraftAtEnd = () => {
    requestAnimationFrame(() => {
      const textarea = draftRef.current;

      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  };

  const loadHealth = async () => {
    const response = await fetch("/api/health");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as HealthState;
    startTransition(() => {
      setHealth(data);
    });
  };

  const setSelectedMode = (mode: ChatRequestMode | null) => {
    selectedModeRef.current = mode;
    setSelectedModeState(mode);
  };

  const sendPrompt = async (
    value: string,
    options?: { mode?: ChatRequestMode | null },
  ) => {
    const message = value.trim();
    const queuedImages = pendingImages;
    const hasPendingImages = queuedImages.length > 0;
    const modeBeforeSend = selectedMode;
    const queuedMode = options?.mode ?? modeBeforeSend;

    if ((!message && !hasPendingImages) || isBusy) {
      return;
    }

    try {
      selectedModeRef.current = queuedMode ?? null;
      setDraft("");
      setPendingImages([]);
      setSidebarOpen(false);
      focusDraftAtEnd();
      await sendMessage(
        hasPendingImages
          ? message
            ? { files: queuedImages, text: message }
            : { files: queuedImages }
          : { text: message },
      );
      if (modeBeforeSend) {
        setSelectedMode(null);
      } else {
        selectedModeRef.current = null;
      }
    } catch {
      setDraft(message);
      setPendingImages(queuedImages);
      selectedModeRef.current = modeBeforeSend;
      if (selectedMode !== modeBeforeSend) {
        setSelectedModeState(modeBeforeSend);
      }
      focusDraftAtEnd();
      return;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendPrompt(draft);
  };

  const handleClarificationSuggestion = async (suggestion: string) => {
    await sendPrompt(suggestion);
  };

  const handleStarterPrompt = async (
    prompt: string,
    mode?: ChatRequestMode,
  ) => {
    await sendPrompt(prompt, { mode });
  };

  const handleImageSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const nextImages = await convertFileListToFileUIParts(files);

    setPendingImages((current) => [...current, ...nextImages].slice(0, 4));
    focusDraftAtEnd();
  };

  const handleRemovePendingImage = (index: number) => {
    setPendingImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleClarificationDraft = (suggestion: string) => {
    const nextDraft = suggestion.trim();

    if (!nextDraft || isBusy) {
      return;
    }

    setDraft(nextDraft);
    setSidebarOpen(false);
    focusDraftAtEnd();
  };

  const handleModeSelect = (mode: ChatRequestMode) => {
    setSelectedMode(selectedMode === mode ? null : mode);
    focusDraftAtEnd();
  };

  const handleClearMode = () => {
    if (!selectedMode) {
      return;
    }

    setSelectedMode(null);
    focusDraftAtEnd();
  };

  const handleCreateChat = () => {
    stop();
    setDraft("");
    setPendingImages([]);
    setSelectedMode(null);
    setSidebarOpen(false);
    setMessages([]);
    setChatId(crypto.randomUUID());
  };

  const toggleSidebar = () => {
    setSidebarOpen((open) => !open);
  };

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
    handleImageSelection,
    handleRemovePendingImage,
    handleStarterPrompt,
    handleSubmit,
    hasConversation,
    health,
    isBusy,
    lastAssistantText,
    pendingImages,
    selectedMode,
    setDraft,
    setSidebarOpen,
    sidebarOpen,
    status,
    stop,
    toggleSidebar,
    handleClearMode,
    handleModeSelect,
  };
};
