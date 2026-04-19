import type {
  AgentExecutionTrace,
  AgentImageInput,
  AgentRequestMode,
} from "../../Agent/Domain/agentTypes.js";

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

export type ConversationSummaryMessageMetadata = {
  kind: "context-summary";
  summarizedMessageCount: number;
};

export type ConversationMessageRecord = {
  id: string;
  role: ConversationMessageRole;
  text: string;
  images: AgentImageInput[];
  metadata?: Record<string, unknown>;
  trace?: AgentExecutionTrace;
  createdAt: string;
};

export type ConversationContextSnapshot = {
  summaryMessage: ConversationMessageRecord | null;
  summaryMessageCount: number;
  messages: ConversationMessageRecord[];
};
