import type { UIMessage } from "@ai-sdk/react";

export const CHAT_REQUEST_MODES = [
  "chat",
  "writing",
  "coding",
  "image",
] as const;

export type ChatRequestMode = (typeof CHAT_REQUEST_MODES)[number];

export const CHAT_REQUEST_MODE_LABELS: Record<ChatRequestMode, string> = {
  chat: "聊天回答",
  coding: "代码编写",
  image: "制作图片",
  writing: "文章编写",
};

export type ChatMessageMetadata = {
  kind?: "clarification";
  suggestions?: string[];
  title?: string;
};

export type ChatMessage = UIMessage<ChatMessageMetadata>;
export type ChatRequestImage = {
  filename?: string;
  mediaType: string;
  url: string;
};

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
  mode?: ChatRequestMode;
  prompt?: string;
};
