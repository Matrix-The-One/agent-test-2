import { randomUUID } from "node:crypto";

import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStream } from "ai";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { AppConfigService } from "../../../../config/app-config.service.js";
import { AgentSkillsService } from "../../../skill-catalog/application/services/agent-skills.service.js";
import type { AgentChatRequest } from "../../domain/agent.schemas.js";
import { AgentGraphFactory } from "../../infrastructure/factories/agent-graph.factory.js";
import { AgentWorkflowGraphFactory } from "../../infrastructure/factories/agent-workflow-graph.factory.js";

@Injectable()
export class AgentService {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  @Inject(AgentGraphFactory)
  private readonly agentGraphFactory!: AgentGraphFactory;

  @Inject(AgentWorkflowGraphFactory)
  private readonly agentWorkflowGraphFactory!: AgentWorkflowGraphFactory;

  @Inject(AgentSkillsService)
  private readonly agentSkillsService!: AgentSkillsService;

  async streamReply(payload: AgentChatRequest) {
    this.assertProviderConfigured();

    const threadId = payload.threadId ?? randomUUID();
    const workflow = await this.agentWorkflowGraphFactory.createGraph().invoke({
      message: payload.message,
      threadId,
    });

    if (
      workflow.clarification.needClarification &&
      workflow.clarification.question
    ) {
      return this.createClarificationStream({
        question: workflow.clarification.question,
        suggestions: workflow.clarification.suggestions,
        title: workflow.clarification.title || "还需要确认一下",
      });
    }

    const selectedSkills =
      workflow.intent === "skill-routing"
        ? this.agentSkillsService.getSkillsByIds(workflow.skillSelection.skillIds)
        : [];

    const stream = await this.agentGraphFactory
      .createGraph(selectedSkills)
      .stream(
        {
          messages: [{ role: "user", content: payload.message }],
        },
        {
          configurable: { thread_id: threadId },
          streamMode: ["values", "messages"],
        },
      );

    return toUIMessageStream(stream as ReadableStream);
  }

  normalizeError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return "Agent execution failed.";
  }

  private assertProviderConfigured() {
    if (this.config.providerConfigured) {
      return;
    }

    throw new ServiceUnavailableException(
      "OPENAI_API_KEY is missing. Add it to apps/server/.env before using the agent endpoint.",
    );
  }

  private createClarificationStream({
    question,
    suggestions,
    title,
  }: {
    question: string;
    suggestions: string[];
    title: string;
  }) {
    const textId = randomUUID();

    return createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          messageMetadata: {
            kind: "clarification",
            suggestions,
            title,
          },
          type: "start",
        });
        writer.write({ id: textId, type: "text-start" });

        for (const chunk of this.chunkText(question)) {
          writer.write({
            delta: chunk,
            id: textId,
            type: "text-delta",
          });
        }

        writer.write({ id: textId, type: "text-end" });
        writer.write({
          finishReason: "stop",
          messageMetadata: {
            kind: "clarification",
            suggestions,
            title,
          },
          type: "finish",
        });
      },
      onError: (error) => this.normalizeError(error),
    });
  }

  private chunkText(text: string) {
    const normalizedText = text.trim();

    if (normalizedText.length <= 12) {
      return [normalizedText];
    }

    const chunks: string[] = [];

    for (let index = 0; index < normalizedText.length; index += 12) {
      chunks.push(normalizedText.slice(index, index + 12));
    }

    return chunks;
  }
}
