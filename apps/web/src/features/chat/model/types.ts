import type { UIMessage } from "@ai-sdk/react";

export type ChatMessageMetadata = {
  kind?: "clarification";
  suggestions?: string[];
  title?: string;
};

export type ChatMessage = UIMessage<ChatMessageMetadata>;

export type HealthState = {
  memoryEnabled: boolean;
  model: string;
  providerConfigured: boolean;
  status: string;
};

export type ConversationPreview = {
  id: string;
  title: string;
  meta: string;
  active?: boolean;
  prompt?: string;
};
