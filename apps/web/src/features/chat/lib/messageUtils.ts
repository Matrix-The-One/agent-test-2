import type { UIMessage } from "@ai-sdk/react";

import type { ChatMessage } from "@/features/chat/model/types";

export const getLatestUserMessageText = (
  message: Pick<UIMessage, "role" | "parts"> | undefined,
) => {
  if (!message || message.role !== "user") {
    return "";
  }

  return getMessageText(message);
};

export const getMessageText = (message: Pick<UIMessage, "parts">) => {
  return message.parts
    .filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
};

export const getMessageImageFiles = (
  message: Pick<UIMessage, "parts"> | undefined,
) => {
  if (!message) {
    return [];
  }

  return message.parts.filter(
    (part): part is Extract<(typeof message.parts)[number], { type: "file" }> =>
      part.type === "file" && part.mediaType.startsWith("image/"),
  );
};

export const getClarificationMetadata = (message: ChatMessage | undefined) => {
  if (!message || message.role !== "assistant") {
    return null;
  }

  return message.metadata?.kind === "clarification" ? message.metadata : null;
};

export const truncateConversationTitle = (value: string, maxLength = 28) => {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
};

export const getConversationTitle = (
  message: Pick<UIMessage, "parts"> | undefined,
) => {
  const text = message ? getMessageText(message) : "";

  if (text) {
    return truncateConversationTitle(text);
  }

  const imageFiles = getMessageImageFiles(message);

  if (imageFiles.length > 0) {
    return imageFiles.length === 1 ? "图片对话" : `${imageFiles.length} 张图片`;
  }

  return "当前对话";
};
