import type { UIMessage } from "@ai-sdk/react";

import type { ChatMessage } from "@/features/chat/model/types";

export function getLatestUserMessageText(
  message: Pick<UIMessage, "role" | "parts"> | undefined,
) {
  if (!message || message.role !== "user") {
    return "";
  }

  return getMessageText(message);
}

export function getMessageText(message: Pick<UIMessage, "parts">) {
  return message.parts
    .filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

export function getClarificationMetadata(message: ChatMessage | undefined) {
  if (!message || message.role !== "assistant") {
    return null;
  }

  return message.metadata?.kind === "clarification" ? message.metadata : null;
}

export function truncateConversationTitle(value: string, maxLength = 28) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}
