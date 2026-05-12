import type { UIMessage } from "@ai-sdk/react";
import type {
  AgentChatRequestDtoMode,
  AgentContextBudgetDto,
  AgentContextBudgetDtoCountingMode,
  AgentContextCompactionDtoStrategy,
  AgentExecutionPlanDtoExecutionMode,
  AgentExecutionTraceDto,
  AgentExecutionTraceDtoImageRole,
  AgentImageInputDto,
  AgentTraceSpecialistDto,
  AgentTraceSpecialistDtoCategory,
  AgentTraceStepDto,
  AgentTraceStepDtoKind,
  AgentTraceStepDtoStatus,
  ConversationListResultDto,
  ConversationMessageRecordDto,
  ConversationRecordDto,
  HealthStatusDto,
  UserRecordDto,
} from "@/services/api/generated/models";

export const CHAT_REQUEST_MODES = [
  "chat",
  "writing",
  "coding",
  "image",
] as const;

export type ChatRequestMode = AgentChatRequestDtoMode;

export const CHAT_REQUEST_MODE_LABELS: Record<ChatRequestMode, string> = {
  chat: "聊天回答",
  coding: "代码编写",
  image: "制作图片",
  writing: "文章编写",
};

export type ChatSkillChoiceRequest = {
  instruction: string;
  optionId: "quick" | "balanced" | "deep";
  originalRequest: string;
  skillId: "interactive-delivery";
};

export type ChatSkillChoiceStatus = "expired" | "pending" | "selected";

export type ChatSkillChoiceOption = {
  description: string;
  id: ChatSkillChoiceRequest["optionId"];
  label: string;
  prompt: string;
  skillChoice: ChatSkillChoiceRequest;
};

export type ChatClarificationMetadata = {
  kind?: "clarification";
  suggestions?: string[];
  title?: string;
};

export type ChatSkillChoiceMetadata = {
  choiceId?: string;
  kind: "skill-choice";
  options: ChatSkillChoiceOption[];
  originalRequest: string;
  question: string;
  selectedOptionId?: ChatSkillChoiceOption["id"];
  skillId: "interactive-delivery";
  status?: ChatSkillChoiceStatus;
  title: string;
};

export type ChatMessageMetadata =
  | ChatClarificationMetadata
  | ChatSkillChoiceMetadata;

export type ChatAgentSkillCategory =
  AgentTraceSpecialistDtoCategory;

export type ChatAgentTraceExecutionMode = AgentExecutionPlanDtoExecutionMode;

export type ChatAgentImageRole = AgentExecutionTraceDtoImageRole;
export type ChatAgentTraceStepKind = AgentTraceStepDtoKind;
export type ChatAgentTraceStepStatus = AgentTraceStepDtoStatus;
export type ChatAgentTokenCountingMode = AgentContextBudgetDtoCountingMode;

export const CHAT_AGENT_TOKEN_COUNTING_MODE_LABELS: Record<
  ChatAgentTokenCountingMode,
  string
> = {
  estimated: "启发式估算",
  exact: "API 精确计数",
  tokenizer: "Tokenizer 估算",
};
export type ChatAgentContextCompactionStrategy =
  AgentContextCompactionDtoStrategy;

export type ChatAgentTraceSpecialist = AgentTraceSpecialistDto;

export type ChatAgentTraceStep = AgentTraceStepDto;

export type ChatAgentContextBudget = AgentContextBudgetDto;

export type ChatAgentTrace = AgentExecutionTraceDto;

export type ChatMessageDataParts = {
  agentTrace: ChatAgentTrace;
};

export type ChatMessage = UIMessage<ChatMessageMetadata, ChatMessageDataParts>;

export type ChatUser = UserRecordDto;

export type ChatConversationRecord = ConversationRecordDto;

export type ChatConversationListPage = ConversationListResultDto;

export type PersistedConversationMessage = ConversationMessageRecordDto;

export type ChatRequestImage = AgentImageInputDto;

export type HealthState = HealthStatusDto;

export type ConversationPreview = {
  id: string;
  title: string;
  meta: string;
  active?: boolean;
  mode?: ChatRequestMode;
  persisted?: boolean;
  prompt?: string;
};
