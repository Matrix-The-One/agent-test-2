export const chatQueryKeys = {
  conversationMessages: (userId: string, conversationId: string) =>
    ["chat", "conversation", userId, conversationId, "messages"] as const,
  conversations: (userId: string) => ["chat", "conversations", userId] as const,
  conversationSearch: (userId: string, query: string) =>
    ["chat", "conversations", userId, "search", query] as const,
  health: () => ["chat", "health"] as const,
  user: (userId: string) => ["chat", "user", userId] as const,
};
