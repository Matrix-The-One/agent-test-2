import { recentConversationSeeds } from "@/features/chat/model/sidebarData";
import type {
  ChatMessage,
  ConversationPreview,
} from "@/features/chat/model/types";
import {
  getConversationTitle,
} from "@/features/chat/lib/messageUtils";

export const buildConversationPreviews = (
  messages: ChatMessage[],
  chatId: string,
): ConversationPreview[] => {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const currentTitle = firstUserMessage ? getConversationTitle(firstUserMessage) : "新聊天";

  const currentMeta =
    messages.length > 0
      ? `${messages.length} 条消息 · ${userMessageCount} 条提问`
      : `线程 ${chatId.slice(0, 8)}`;

  return [
    {
      active: true,
      id: chatId,
      meta: currentMeta,
      title: currentTitle,
    },
    ...recentConversationSeeds,
  ];
};
