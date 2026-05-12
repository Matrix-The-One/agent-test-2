import type { UIMessage } from "@ai-sdk/react";

import type {
  PersistedConversationMessage,
  ChatAgentTrace,
  ChatMessage,
  ChatSkillChoiceMetadata,
} from "@/store/chat/types";

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

export const getSkillChoiceMetadata = (
  message: ChatMessage | undefined,
): ChatSkillChoiceMetadata | null => {
  if (!message || message.role !== "assistant") {
    return null;
  }

  return message.metadata?.kind === "skill-choice" ? message.metadata : null;
};

export const getAgentTrace = (
  message: ChatMessage | undefined,
): ChatAgentTrace | null => {
  if (!message || message.role !== "assistant") {
    return null;
  }

  const tracePart = [...message.parts].reverse().find(
    (
      part,
    ): part is Extract<(typeof message.parts)[number], { type: "data-agentTrace" }> =>
      part.type === "data-agentTrace",
  );

  return tracePart?.data ?? null;
};

export const getLatestAgentTrace = (messages: readonly ChatMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const trace = getAgentTrace(messages[index]);

    if (trace) {
      return trace;
    }
  }

  return null;
};

export const mapPersistedConversationMessageToChatMessage = (
  message: PersistedConversationMessage,
): ChatMessage => {
  const parts: ChatMessage["parts"] = [];

  if (message.role === "user") {
    for (const image of message.images) {
      parts.push({
        filename: image.filename,
        mediaType: image.mediaType,
        type: "file",
        url: image.url,
      });
    }
  }

  if (message.text) {
    parts.push({
      text: message.text,
      type: "text",
    });
  }

  if (message.role === "assistant" && message.trace) {
    parts.push({
      data: message.trace,
      id: "agent-trace",
      type: "data-agentTrace",
    });
  }

  return {
    id: message.id,
    ...(message.metadata ? { metadata: message.metadata } : {}),
    parts,
    role: message.role,
  };
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
