import type {
  AgentExecutionTrace,
  AgentImageInput,
  AgentRequestMode,
} from "../../Agent/Domain/agentTypes.js";

// ConversationRecord 是侧边栏会话列表使用的轻量会话结构。
export type ConversationRecord = {
  id: string;
  userId: string;
  title: string;
  mode?: AgentRequestMode;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ConversationListResult = {
  items: ConversationRecord[];
  nextCursor?: string;
};

export type ConversationMessageRole = "system" | "user" | "assistant";

// context-summary 是特殊 system message，用于保存长对话 running summary。
export type ConversationSummaryMessageMetadata = {
  kind: "context-summary";
  summarizedMessageCount: number;
};

export type ConversationMessageRecord = {
  // 这是前端历史消息和 Agent 上下文窗口共同使用的领域消息结构。
  id: string;
  role: ConversationMessageRole;
  text: string;
  images: AgentImageInput[];
  metadata?: Record<string, unknown>;
  trace?: AgentExecutionTrace;
  createdAt: string;
};

export type ConversationContextSnapshot = {
  // AgentContextWindowService 用它区分摘要消息和普通消息，避免重复计入上下文。
  summaryMessage: ConversationMessageRecord | null;
  summaryMessageCount: number;
  messages: ConversationMessageRecord[];
};
