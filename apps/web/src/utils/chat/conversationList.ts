import type {
  ChatConversationRecord,
  ConversationPreview,
} from "@/store/chat/types";

const formatConversationMeta = (messageCount: number) =>
  messageCount > 0 ? `${messageCount} 条消息` : "还没有消息";

export const buildConversationPreviews = (
  savedConversations: ChatConversationRecord[],
  activeConversationId?: string,
): ConversationPreview[] => {
  return savedConversations.map((conversation) => ({
    active: conversation.id === activeConversationId,
    id: conversation.id,
    meta: formatConversationMeta(conversation.messageCount),
    mode: conversation.mode,
    persisted: true,
    title: conversation.title,
  }));
};
