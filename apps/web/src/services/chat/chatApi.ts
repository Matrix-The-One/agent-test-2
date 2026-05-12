import type { AxiosResponse } from "axios";
import { isAxiosError } from "axios";

import {
  deleteConversation as deleteConversationRequest,
  ensureUser as ensureUserRequest,
  getConversationMessages as getConversationMessagesRequest,
  getHealth as getHealthRequest,
  listConversations as listConversationsRequest,
  submitAgentSkillChoice as submitAgentSkillChoiceRequest,
  updateConversation as updateConversationRequest,
} from "@/services/api/generated/endpoints";
import type {
  ChatConversationListPage,
  ChatConversationRecord,
  HealthState,
  ChatUser,
  ChatSkillChoiceRequest,
  PersistedConversationMessage,
} from "@/store/chat/types";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  errorMsg: string;
  errorCode?: string | null;
  errors?: unknown;
};

const isApiEnvelope = <T>(value: unknown): value is ApiEnvelope<T> =>
  typeof value === "object"
  && value !== null
  && "success" in value
  && "errorMsg" in value
  && "data" in value;

const extractErrorMessage = (payload: unknown) => {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return "请求失败。";
  }

  const body = payload as {
    errorMsg?: unknown;
    message?: unknown;
  };

  if (typeof body.errorMsg === "string" && body.errorMsg.length > 0) {
    return body.errorMsg;
  }

  if (typeof body.message === "string" && body.message.length > 0) {
    return body.message;
  }

  return "请求失败。";
};

const unwrapApiPayload = <T>(payload: unknown): T => {
  if (isApiEnvelope<T>(payload)) {
    if (!payload.success) {
      throw new Error(payload.errorMsg || "请求失败。");
    }

    return payload.data as T;
  }

  return payload as T;
};

const request = async <T>(
  apiCall: Promise<AxiosResponse<ApiEnvelope<T>>>,
) => {
  try {
    const response = await apiCall;

    return unwrapApiPayload<T>(response.data);
  } catch (error) {
    if (isAxiosError(error)) {
      throw new Error(extractErrorMessage(error.response?.data));
    }

    throw error;
  }
};

export const ensureChatUser = async (userId: string) => {
  return request<ChatUser>(
    ensureUserRequest({
      displayName: "Local User",
      id: userId,
    }),
  );
};

export const listChatConversations = async (
  userId: string,
  options: {
    cursor?: string;
    limit?: number;
    query?: string;
  } = {},
) => {
  return request<ChatConversationListPage>(
    listConversationsRequest({
      ...(options.cursor ? { cursor: options.cursor } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
      ...(options.query ? { query: options.query } : {}),
      userId,
    }),
  );
};

export const getChatConversationMessages = async (
  conversationId: string,
  userId: string,
) => {
  return request<PersistedConversationMessage[]>(
    getConversationMessagesRequest(conversationId, {
      userId,
    }),
  );
};

export const updateChatConversation = async (
  conversationId: string,
  input: {
    mode?: ChatConversationRecord["mode"];
    title?: string;
    userId: string;
  },
) => {
  return request<ChatConversationRecord>(
    updateConversationRequest(conversationId, input),
  );
};

export const deleteChatConversation = async (
  conversationId: string,
  userId: string,
) => {
  return request<{ conversationId: string; deleted: boolean }>(
    deleteConversationRequest(conversationId, {
      userId,
    }),
  );
};

export const getHealthState = async () => {
  return request<HealthState>(getHealthRequest());
};

export const submitChatSkillChoice = async (
  choiceId: string,
  input: ChatSkillChoiceRequest,
) => {
  return request<{ accepted: boolean; choiceId: string }>(
    submitAgentSkillChoiceRequest(choiceId, input),
  );
};
