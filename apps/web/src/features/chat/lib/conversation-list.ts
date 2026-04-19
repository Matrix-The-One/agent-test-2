import { recentConversationSeeds } from "@/features/chat/model/sidebar-data";
import type {
  ChatMessage,
  ConversationPreview,
} from "@/features/chat/model/types";
import {
  getMessageText,
  truncateConversationTitle,
} from "@/features/chat/lib/message-utils";

export function buildConversationPreviews(
  messages: ChatMessage[],
  chatId: string,
): ConversationPreview[] {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const currentTitle = firstUserMessage
    ? truncateConversationTitle(getMessageText(firstUserMessage) || "当前对话")
    : "新聊天";

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
}
