import { randomUUID } from "node:crypto";

import { HumanMessage, type MessageContent } from "@langchain/core/messages";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStream } from "ai";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";
import { AgentSkillsService } from "../../../SkillCatalog/Application/Services/agentSkillsService.js";
import type { AgentChatRequest } from "../../Domain/agentSchemas.js";
import { AgentGraphFactory } from "../../Infrastructure/Factories/agentGraphFactory.js";
import { AgentWorkflowGraphFactory } from "../../Infrastructure/Factories/agentWorkflowGraphFactory.js";

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
    const threadId = payload.threadId ?? randomUUID();
    const workflow = await this.agentWorkflowGraphFactory.createGraph().invoke({
      images: payload.images,
      message: payload.message,
      requestedMode: payload.mode,
      threadId,
    });

    if (workflow.intent === "image") {
      return this.createTextStream(
        `已识别为 image 意图, 当前图片输入角色为 ${workflow.imageRole}。服务端已经支持图片路由, 但还没有接入图片生成或改图模型。`,
      );
    }

    this.assertProviderConfigured();

    const selectedSkills = this.agentSkillsService.getSkillsByIds(
      workflow.skillSelection.skillIds,
    );

    const stream = await this.agentGraphFactory
      .createGraph(selectedSkills)
      .stream(
        {
          messages: [
            new HumanMessage(
              this.buildUserMessageContent({
                hasImages: workflow.hasImages,
                imageRole: workflow.imageRole,
                images: payload.images,
                message: payload.message,
              }),
            ),
          ],
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

  private buildUserMessageContent({
    hasImages,
    imageRole,
    images,
    message,
  }: {
    hasImages: boolean;
    imageRole: string;
    images: AgentChatRequest["images"];
    message: string;
  }): MessageContent {
    const normalizedMessage = message.trim();

    if (!hasImages) {
      return normalizedMessage;
    }

    const text =
      normalizedMessage ||
      (imageRole === "reference"
        ? "请先理解这张参考图的风格和关键视觉元素。"
        : imageRole === "edit"
          ? "请先理解这张待编辑图片的当前内容和可修改区域。"
          : "请先分析这张图片的主要内容, 然后给出简洁结论。");

    return [
      { text, type: "text" },
      ...images.map((image: AgentChatRequest["images"][number]) => ({
        image_url: {
          url: image.url,
        },
        type: "image_url" as const,
      })),
    ];
  }

  private assertProviderConfigured() {
    if (this.config.providerConfigured) {
      return;
    }

    throw new ServiceUnavailableException(
      "OPENAI_API_KEY is missing. Add it to apps/server/.env.agent before using the agent endpoint.",
    );
  }

  private createTextStream(text: string) {
    const textId = randomUUID();

    return createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "start" });
        writer.write({ id: textId, type: "text-start" });

        for (const chunk of this.chunkText(text)) {
          writer.write({
            delta: chunk,
            id: textId,
            type: "text-delta",
          });
        }

        writer.write({ id: textId, type: "text-end" });
        writer.write({
          finishReason: "stop",
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
