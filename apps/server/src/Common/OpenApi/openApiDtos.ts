import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  AGENT_IMAGE_ROLES,
  AGENT_INTENTS,
} from "../../Modules/Agent/Domain/agentTypes.js";
import { AGENT_SKILL_IDS } from "../../Modules/SkillCatalog/Domain/agentSkillTypes.js";

const AGENT_SKILL_CATEGORIES = [
  "project",
  "location",
  "architecture",
  "delivery",
  "quality",
  "content",
  "artifact",
  "engineering",
  "document",
] as const;
const AGENT_SKILL_POPULARITIES = ["core", "popular"] as const;
const AGENT_EXECUTION_MODES = [
  "image-placeholder",
  "dynamic-supervisor",
  "fixed-chain",
] as const;
const AGENT_TOKEN_COUNTING_MODES = [
  "exact",
  "tokenizer",
  "estimated",
] as const;
const AGENT_CONTEXT_COMPACTION_STRATEGIES = [
  "none",
  "running-summary",
] as const;
const AGENT_TRACE_STEP_KINDS = ["specialist", "responder"] as const;
const AGENT_TRACE_STEP_STATUSES = ["planned", "running", "completed"] as const;
const CONVERSATION_MESSAGE_ROLES = ["system", "user", "assistant"] as const;

export class AgentImageInputDto {
  @ApiPropertyOptional({ maxLength: 255, type: String })
  filename?: string;

  @ApiProperty({ example: "image/png", type: String })
  mediaType!: string;

  @ApiProperty({ example: "data:image/png;base64,...", type: String })
  url!: string;
}

export class AgentContextCompactionDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ type: Boolean })
  applied!: boolean;

  @ApiProperty({ enum: AGENT_CONTEXT_COMPACTION_STRATEGIES, type: String })
  strategy!: (typeof AGENT_CONTEXT_COMPACTION_STRATEGIES)[number];

  @ApiProperty({ type: Number })
  summaryMessageCount!: number;
}

export class AgentContextBudgetDto {
  @ApiProperty({ enum: AGENT_TOKEN_COUNTING_MODES, type: String })
  countingMode!: (typeof AGENT_TOKEN_COUNTING_MODES)[number];

  @ApiProperty({ type: AgentContextCompactionDto })
  compaction!: AgentContextCompactionDto;

  @ApiProperty({ type: Number })
  contextWindowTokens!: number;

  @ApiProperty({ type: Number })
  inputTokens!: number;

  @ApiProperty({ type: Number })
  maxConversationTokens!: number;

  @ApiProperty({ type: String })
  model!: string;

  @ApiProperty({ type: Number })
  reservedInstructionTokens!: number;

  @ApiProperty({ type: Number })
  reservedOutputTokens!: number;

  @ApiProperty({ type: Number })
  usagePercent!: number;
}

export class AgentTraceRoutingDto {
  @ApiProperty({ type: String })
  imageRoleReason!: string;

  @ApiProperty({ type: String })
  intentReason!: string;

  @ApiProperty({
    enum: AGENT_SKILL_IDS,
    isArray: true,
  })
  skillIds!: (typeof AGENT_SKILL_IDS)[number][];

  @ApiProperty({ type: String })
  skillSelectionReason!: string;
}

export class AgentTraceSpecialistDto {
  @ApiProperty({ enum: AGENT_SKILL_CATEGORIES, type: String })
  category!: (typeof AGENT_SKILL_CATEGORIES)[number];

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  model!: string;

  @ApiProperty({
    enum: AGENT_SKILL_IDS,
    isArray: true,
  })
  skillIds!: (typeof AGENT_SKILL_IDS)[number][];

  @ApiProperty({ isArray: true, type: String })
  skillNames!: string[];
}

export class AgentTraceStepDto {
  @ApiPropertyOptional({ enum: AGENT_SKILL_CATEGORIES, type: String })
  category?: (typeof AGENT_SKILL_CATEGORIES)[number];

  @ApiPropertyOptional({ type: String })
  completedAt?: string;

  @ApiPropertyOptional({ type: Number })
  durationMs?: number;

  @ApiPropertyOptional({ type: String })
  expectedOutput?: string;

  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ enum: AGENT_TRACE_STEP_KINDS, type: String })
  kind!: (typeof AGENT_TRACE_STEP_KINDS)[number];

  @ApiProperty({ type: String })
  model!: string;

  @ApiPropertyOptional({ type: String })
  startedAt?: string;

  @ApiProperty({ enum: AGENT_TRACE_STEP_STATUSES, type: String })
  status!: (typeof AGENT_TRACE_STEP_STATUSES)[number];

  @ApiPropertyOptional({ type: String })
  summary?: string;

  @ApiPropertyOptional({ type: String })
  task?: string;

  @ApiProperty({ type: String })
  title!: string;
}

export class AgentExecutionResponderDto {
  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  model!: string;

  @ApiProperty({ type: String })
  stepId!: string;
}

export class AgentExecutionPlanDto {
  @ApiProperty({
    isArray: true,
    type: AgentTraceSpecialistDto,
  })
  availableSpecialists!: AgentTraceSpecialistDto[];

  @ApiProperty({ enum: AGENT_EXECUTION_MODES, type: String })
  executionMode!: (typeof AGENT_EXECUTION_MODES)[number];

  @ApiProperty({ type: AgentExecutionResponderDto })
  responder!: AgentExecutionResponderDto;

  @ApiProperty({
    isArray: true,
    type: AgentTraceStepDto,
  })
  steps!: AgentTraceStepDto[];
}

export class AgentExecutionTraceDto {
  @ApiProperty({ type: AgentContextBudgetDto })
  contextBudget!: AgentContextBudgetDto;

  @ApiProperty({ type: AgentExecutionPlanDto })
  execution!: AgentExecutionPlanDto;

  @ApiProperty({ type: Boolean })
  hasImages!: boolean;

  @ApiProperty({ enum: AGENT_IMAGE_ROLES, type: String })
  imageRole!: (typeof AGENT_IMAGE_ROLES)[number];

  @ApiProperty({ enum: AGENT_INTENTS, type: String })
  intent!: (typeof AGENT_INTENTS)[number];

  @ApiPropertyOptional({ enum: AGENT_INTENTS, type: String })
  requestedMode?: (typeof AGENT_INTENTS)[number];

  @ApiProperty({ type: AgentTraceRoutingDto })
  routing!: AgentTraceRoutingDto;

  @ApiProperty({ type: Number })
  routingDurationMs!: number;

  @ApiProperty({ type: String })
  startedAt!: string;

  @ApiProperty({ type: String })
  threadId!: string;

  @ApiPropertyOptional({ type: Number })
  totalDurationMs?: number;

  @ApiProperty({ type: String })
  updatedAt!: string;
}

export class ConversationRecordDto {
  @ApiProperty({ type: String })
  createdAt!: string;

  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: Number })
  messageCount!: number;

  @ApiPropertyOptional({ enum: AGENT_INTENTS, type: String })
  mode?: (typeof AGENT_INTENTS)[number];

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  updatedAt!: string;

  @ApiProperty({ format: "uuid", type: String })
  userId!: string;
}

export class ConversationListResultDto {
  @ApiProperty({
    isArray: true,
    type: ConversationRecordDto,
  })
  items!: ConversationRecordDto[];

  @ApiPropertyOptional({ format: "uuid", type: String })
  nextCursor?: string;
}

export class ConversationMessageRecordDto {
  @ApiProperty({ type: String })
  createdAt!: string;

  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({
    isArray: true,
    type: AgentImageInputDto,
  })
  images!: AgentImageInputDto[];

  @ApiPropertyOptional({
    additionalProperties: true,
    type: "object",
  })
  metadata?: Record<string, unknown>;

  @ApiProperty({ enum: CONVERSATION_MESSAGE_ROLES, type: String })
  role!: (typeof CONVERSATION_MESSAGE_ROLES)[number];

  @ApiProperty({ type: String })
  text!: string;

  @ApiPropertyOptional({ type: AgentExecutionTraceDto })
  trace?: AgentExecutionTraceDto;
}

export class UserRecordDto {
  @ApiProperty({ type: String })
  createdAt!: string;

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiPropertyOptional({ type: String })
  email?: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  updatedAt!: string;
}

export class HealthStatusDto {
  @ApiProperty({ type: Boolean })
  databaseConfigured!: boolean;

  @ApiProperty({ type: Boolean })
  databaseReady!: boolean;

  @ApiProperty({ type: Boolean })
  memoryEnabled!: boolean;

  @ApiProperty({ type: String })
  model!: string;

  @ApiProperty({ type: Boolean })
  providerConfigured!: boolean;

  @ApiProperty({ enum: ["ok"], type: String })
  status!: "ok";
}

export class PublicAgentSkillDto {
  @ApiProperty({ enum: AGENT_SKILL_CATEGORIES, type: String })
  category!: (typeof AGENT_SKILL_CATEGORIES)[number];

  @ApiProperty({ type: String })
  categoryLabel!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ enum: AGENT_SKILL_IDS, type: String })
  id!: (typeof AGENT_SKILL_IDS)[number];

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ enum: AGENT_SKILL_POPULARITIES, type: String })
  popularity!: (typeof AGENT_SKILL_POPULARITIES)[number];

  @ApiProperty({ isArray: true, type: String })
  tags!: string[];

  @ApiProperty({ isArray: true, type: String })
  toolNames!: string[];

  @ApiProperty({ isArray: true, type: String })
  useCases!: string[];
}

export class SkillCatalogDto {
  @ApiProperty({
    enum: AGENT_SKILL_IDS,
    isArray: true,
  })
  popularSkillIds!: (typeof AGENT_SKILL_IDS)[number][];

  @ApiProperty({
    isArray: true,
    type: PublicAgentSkillDto,
  })
  skills!: PublicAgentSkillDto[];

  @ApiProperty({ type: Number })
  total!: number;
}
