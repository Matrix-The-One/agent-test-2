import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { convertFileListToFileUIParts, DefaultChatTransport, type FileUIPart } from "ai";

import {
  deleteChatConversation,
  ensureChatUser,
  getHealthState,
  getChatConversationMessages,
  listChatConversations,
  updateChatConversation,
} from "@/services/chat/chatApi";
import {
  getClarificationMetadata,
  getLatestAgentTrace,
  getMessageImageFiles,
  getLatestUserMessageText,
  getMessageText,
  mapPersistedConversationMessageToChatMessage,
} from "@/utils/chat/messageUtils";
import { chatQueryKeys } from "@/services/chat/queryKeys";
import type {
  ChatConversationListPage,
  ChatConversationRecord,
  ChatMessage,
  ChatRequestImage,
  ChatRequestMode,
  ChatUser,
} from "@/store/chat/types";

const LOCAL_USER_STORAGE_KEY = "agent:local-user-id";
const SAVED_CONVERSATIONS_PAGE_SIZE = 20;

const getStoredUserId = () => {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  const existingUserId = window.localStorage.getItem(LOCAL_USER_STORAGE_KEY);

  if (existingUserId) {
    return existingUserId;
  }

  const nextUserId = crypto.randomUUID();
  window.localStorage.setItem(LOCAL_USER_STORAGE_KEY, nextUserId);
  return nextUserId;
};

const flattenConversationPages = (
  pages: ChatConversationListPage[] | undefined,
) => pages?.flatMap((page) => page.items) ?? [];

export const useAgentChatWorkspace = () => {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const queryClient = useQueryClient();
  const activeConversationId = params.conversationId;
  const [storedUserId] = useState(getStoredUserId);
  const [draft, setDraft] = useState("");
  const [draftConversationId, setDraftConversationId] = useState<string>(
    () => crypto.randomUUID(),
  );
  const [chatId, setChatId] = useState<string>(
    () => activeConversationId ?? crypto.randomUUID(),
  );
  const [chatSeedMessages, setChatSeedMessages] = useState<ChatMessage[]>([]);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(
    null,
  );
  const [pendingImages, setPendingImages] = useState<FileUIPart[]>([]);
  const [selectedMode, setSelectedModeState] = useState<ChatRequestMode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeConversationIdRef = useRef<string | undefined>(activeConversationId);
  const currentUserRef = useRef<ChatUser | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const pendingConversationIdRef = useRef<string | null>(pendingConversationId);
  const selectedModeRef = useRef<ChatRequestMode | null>(null);
  const currentUserQueryKey = chatQueryKeys.user(storedUserId);
  const loadCurrentUser = () => ensureChatUser(storedUserId);
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
              userId: currentUserRef.current?.id,
            },
          };
        },
      }),
  );
  const currentUserQuery = useQuery({
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: loadCurrentUser,
    queryKey: currentUserQueryKey,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const healthQuery = useQuery({
    queryFn: getHealthState,
    queryKey: chatQueryKeys.health(),
  });
  const savedConversationsQuery = useInfiniteQuery<ChatConversationListPage>({
    enabled: Boolean(currentUserQuery.data?.id),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listChatConversations(currentUserQuery.data!.id, {
        cursor: pageParam as string | undefined,
        limit: SAVED_CONVERSATIONS_PAGE_SIZE,
      }),
    queryKey: chatQueryKeys.conversations(currentUserQuery.data?.id ?? "anonymous"),
  });
  const activeConversationMessagesQuery = useQuery({
    enabled: Boolean(
      activeConversationId
      && currentUserQuery.data?.id
      && pendingConversationId !== activeConversationId,
    ),
    queryFn: () =>
      getChatConversationMessages(
        activeConversationId!,
        currentUserQuery.data!.id,
      ),
    queryKey: chatQueryKeys.conversationMessages(
      currentUserQuery.data?.id ?? "anonymous",
      activeConversationId ?? "draft",
    ),
    refetchOnMount: "always",
    staleTime: 0,
  });
  const { error, messages, sendMessage, setMessages, status, stop } =
    useChat<ChatMessage>({
      id: chatId,
      messages: chatSeedMessages,
      onFinish: async () => {
        const runtimeUser = currentUserRef.current;

        if (!runtimeUser) {
          return;
        }

        const nextConversationId =
          activeConversationIdRef.current ?? pendingConversationIdRef.current;

        if (pendingConversationIdRef.current === nextConversationId) {
          pendingConversationIdRef.current = null;
          setPendingConversationId(null);
        }

        await queryClient.invalidateQueries({
          queryKey: chatQueryKeys.conversations(runtimeUser.id),
        });
        if (nextConversationId) {
          await queryClient.invalidateQueries({
            exact: true,
            queryKey: chatQueryKeys.conversationMessages(
              runtimeUser.id,
              nextConversationId,
            ),
          });
        }
      },
      transport,
    });

  const currentUser = currentUserQuery.data ?? null;
  const deferredMessages = useDeferredValue(messages);
  const savedConversations = flattenConversationPages(
    savedConversationsQuery.data?.pages,
  );
  const health = healthQuery.data ?? null;
  const isBusy = status === "submitted" || status === "streaming";
  const isLoadingSavedConversations =
    savedConversationsQuery.isPending || savedConversationsQuery.isFetchingNextPage;
  const isLoadingConversationMessages = activeConversationMessagesQuery.isPending;
  const hasConversation = deferredMessages.length > 0 || Boolean(activeConversationId);
  const lastAssistantMessage = deferredMessages
    .filter((message) => message.role === "assistant")
    .at(-1);
  const lastAssistantText = lastAssistantMessage
    ? getMessageText(lastAssistantMessage)
    : "";
  const awaitingClarification = Boolean(
    getClarificationMetadata(lastAssistantMessage),
  );
  const latestAgentTrace = getLatestAgentTrace(deferredMessages);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    pendingConversationIdRef.current = pendingConversationId;
  }, [pendingConversationId]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (!activeConversationId) {
      const nextChatId = draftConversationId;

      setChatId(nextChatId);
      setChatSeedMessages([]);
      setMessages([]);
      return;
    }

    setChatId(activeConversationId);

    if (pendingConversationId === activeConversationId) {
      return;
    }

    if (!activeConversationMessagesQuery.data) {
      setChatSeedMessages([]);
      setMessages([]);
      return;
    }

    const nextMessages = activeConversationMessagesQuery.data.map(
      mapPersistedConversationMessageToChatMessage,
    );

    setChatSeedMessages(nextMessages);
    setMessages(nextMessages);
  }, [
    activeConversationId,
    activeConversationMessagesQuery.data,
    draftConversationId,
    pendingConversationId,
    setMessages,
  ]);

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

  const ensureRuntimeUser = async () => {
    if (currentUserRef.current) {
      return currentUserRef.current;
    }

    const nextUser = await queryClient.fetchQuery({
      gcTime: Number.POSITIVE_INFINITY,
      queryFn: loadCurrentUser,
      queryKey: currentUserQueryKey,
      staleTime: Number.POSITIVE_INFINITY,
    });

    currentUserRef.current = nextUser;
    return nextUser;
  };

  const setSelectedMode = (mode: ChatRequestMode | null) => {
    selectedModeRef.current = mode;
    setSelectedModeState(mode);
  };

  const sendPrompt = async (
    value: string,
    options?: { mode?: ChatRequestMode | null },
  ) => {
    const runtimeUser = await ensureRuntimeUser();
    const message = value.trim();
    const queuedImages = pendingImages;
    const hasPendingImages = queuedImages.length > 0;
    const modeBeforeSend = selectedMode;
    const queuedMode = options?.mode ?? modeBeforeSend;
    const nextConversationId = activeConversationId ?? draftConversationId;
    const shouldCreateConversationRoute = !activeConversationId;

    if ((!message && !hasPendingImages) || isBusy) {
      return;
    }

    try {
      if (shouldCreateConversationRoute) {
        pendingConversationIdRef.current = nextConversationId;
        setPendingConversationId(nextConversationId);
        setChatId(nextConversationId);
        await navigate({
          params: {
            conversationId: nextConversationId,
          },
          resetScroll: false,
          to: "/conversations/$conversationId",
        });
      }

      selectedModeRef.current = queuedMode ?? null;
      setDraft("");
      setPendingImages([]);
      setSidebarOpen(false);
      focusDraftAtEnd();
      currentUserRef.current = runtimeUser;
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
      pendingConversationIdRef.current = null;
      setPendingConversationId(null);
      if (selectedMode !== modeBeforeSend) {
        setSelectedModeState(modeBeforeSend);
      }
      if (shouldCreateConversationRoute) {
        await navigate({
          resetScroll: false,
          to: "/",
        });
      }
      focusDraftAtEnd();
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
    setPendingImages((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
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

  const handleConversationSelect = async (conversationId: string) => {
    const runtimeUser = await ensureRuntimeUser();

    stop();
    setSidebarOpen(false);
    setSelectedMode(null);
    focusDraftAtEnd();

    if (conversationId === activeConversationIdRef.current) {
      await queryClient.invalidateQueries({
        exact: true,
        queryKey: chatQueryKeys.conversationMessages(
          runtimeUser.id,
          conversationId,
        ),
      });
      return;
    }

    await navigate({
      params: {
        conversationId,
      },
      resetScroll: false,
      to: "/conversations/$conversationId",
    });
  };

  const handleConversationRename = async (
    conversationId: string,
    title: string,
  ) => {
    const runtimeUser = await ensureRuntimeUser();
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      throw new Error("标题不能为空。");
    }

    await updateChatConversation(conversationId, {
      title: normalizedTitle,
      userId: runtimeUser.id,
    });
    await queryClient.invalidateQueries({
      queryKey: chatQueryKeys.conversations(runtimeUser.id),
    });
  };

  const handleConversationDelete = async (conversationId: string) => {
    const runtimeUser = await ensureRuntimeUser();

    await deleteChatConversation(conversationId, runtimeUser.id);
    await queryClient.invalidateQueries({
      queryKey: chatQueryKeys.conversations(runtimeUser.id),
    });

    if (conversationId !== activeConversationIdRef.current) {
      return;
    }

    const nextDraftConversationId = crypto.randomUUID();

    stop();
    setDraft("");
    setPendingImages([]);
    setSelectedMode(null);
    setSidebarOpen(false);
    setPendingConversationId(null);
    pendingConversationIdRef.current = null;
    setChatId(nextDraftConversationId);
    setChatSeedMessages([]);
    setDraftConversationId(nextDraftConversationId);
    setMessages([]);
    await navigate({
      replace: true,
      resetScroll: false,
      to: "/",
    });
  };

  const handleClearMode = () => {
    if (!selectedMode) {
      return;
    }

    setSelectedMode(null);
    focusDraftAtEnd();
  };

  const handleCreateChat = () => {
    const nextDraftConversationId = crypto.randomUUID();

    stop();
    setDraft("");
    setPendingImages([]);
    setSelectedMode(null);
    setSidebarOpen(false);
    setPendingConversationId(null);
    pendingConversationIdRef.current = null;
    setChatId(nextDraftConversationId);
    setChatSeedMessages([]);
    setDraftConversationId(nextDraftConversationId);
    setMessages([]);
    void navigate({
      replace: activeConversationIdRef.current ? true : undefined,
      resetScroll: false,
      to: "/",
    });
    focusDraftAtEnd();
  };

  const loadMoreSavedConversations = async () => {
    if (
      !savedConversationsQuery.hasNextPage
      || savedConversationsQuery.isFetchingNextPage
    ) {
      return;
    }

    await savedConversationsQuery.fetchNextPage();
  };

  const toggleSidebar = () => {
    setSidebarOpen((open) => !open);
  };

  return {
    awaitingClarification,
    chatId,
    currentUser,
    deferredMessages,
    draft,
    draftRef,
    error,
    handleClearMode,
    handleClarificationDraft,
    handleClarificationSuggestion,
    handleConversationDelete,
    handleConversationRename,
    handleConversationSelect,
    handleCreateChat,
    handleImageSelection,
    handleModeSelect,
    handleRemovePendingImage,
    handleStarterPrompt,
    handleSubmit,
    hasConversation,
    health,
    isBusy,
    isLoadingConversationMessages,
    isLoadingSavedConversations,
    lastAssistantText,
    latestAgentTrace,
    loadMoreSavedConversations,
    pendingImages,
    savedConversations,
    savedConversationsHasMore: Boolean(savedConversationsQuery.hasNextPage),
    selectedMode,
    setDraft,
    setSidebarOpen,
    sidebarOpen,
    status,
    stop,
    toggleSidebar,
  };
};
