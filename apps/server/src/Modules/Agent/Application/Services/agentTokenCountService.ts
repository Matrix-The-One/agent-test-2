import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  encodingForModel,
  getEncoding,
  type Tiktoken,
} from "js-tiktoken";

import { AppConfigService } from "../../../../Config/appConfigService.js";
import type {
  AgentImageInput,
  AgentTokenCountingMode,
} from "../../Domain/agentTypes.js";

type ContextTokenMessage = {
  role: "assistant" | "system" | "user";
  text: string;
  images?: AgentImageInput[];
};

type CountEndpointSupport = "unknown" | "supported" | "unsupported";

@Injectable()
export class AgentTokenCountService {
  private readonly logger = new Logger(AgentTokenCountService.name);

  private countEndpointSupport: CountEndpointSupport = "unknown";

  private readonly tokenizers = new Map<string, Tiktoken>();

  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  async countConversationInputTokens(input: {
    messages: readonly ContextTokenMessage[];
    model: string;
  }) {
    const estimatedTokens = this.estimateTokens(input.messages);
    const tokenizerTokens = this.countWithTokenizer(input);
    const fallbackResult =
      tokenizerTokens != null
        ? {
            countingMode: "tokenizer" as AgentTokenCountingMode,
            inputTokens: tokenizerTokens,
          }
        : {
            countingMode: "estimated" as AgentTokenCountingMode,
            inputTokens: estimatedTokens,
          };

    if (!this.config.tokenCountProviderConfigured) {
      return fallbackResult;
    }

    if (this.countEndpointSupport === "unsupported") {
      return fallbackResult;
    }

    try {
      const response = await fetch(this.buildCountEndpointUrl(), {
        body: JSON.stringify({
          input: input.messages.map((message) => ({
            content: this.buildMessageContent(message),
            role: message.role,
          })),
          model: input.model,
        }),
        headers: {
          Authorization: `Bearer ${this.config.openAiTokenCountApiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (this.isUnsupportedEndpointResponse(response.status)) {
        this.markCountEndpointUnsupported();
        return fallbackResult;
      }

      if (!response.ok) {
        throw new Error(`Token count request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as {
        input_tokens?: unknown;
      };

      if (typeof payload.input_tokens !== "number") {
        throw new Error("Token count response is missing input_tokens.");
      }

      this.countEndpointSupport = "supported";

      return {
        countingMode: "exact" as AgentTokenCountingMode,
        inputTokens: payload.input_tokens,
      };
    } catch {
      return fallbackResult;
    }
  }

  private buildMessageContent(message: ContextTokenMessage) {
    const normalizedText = message.text.trim();

    if (!message.images?.length) {
      return normalizedText;
    }

    return [
      ...(normalizedText
        ? [{ text: normalizedText, type: "input_text" as const }]
        : []),
      ...message.images.map((image) => ({
        image_url: image.url,
        type: "input_image" as const,
      })),
    ];
  }

  private buildCountEndpointUrl() {
    const baseUrl =
      this.config.openAiTokenCountBaseUrl ?? "https://api.openai.com/v1";

    return `${baseUrl.replace(/\/+$/, "")}/responses/input_tokens`;
  }

  private countWithTokenizer(input: {
    messages: readonly ContextTokenMessage[];
    model: string;
  }) {
    const tokenizer = this.resolveTokenizer(input.model);

    if (!tokenizer) {
      return null;
    }

    return input.messages.reduce((total, message) => {
      const text = message.text.trim();
      const roleTokens = tokenizer.encode(message.role).length;
      const textTokens = text ? tokenizer.encode(text).length : 0;
      const imageTokenEstimate = (message.images?.length ?? 0) * 256;

      return total + roleTokens + textTokens + imageTokenEstimate + 8;
    }, 0);
  }

  private resolveTokenizer(model: string) {
    const normalizedModel = model.trim();
    const cachedTokenizer = this.tokenizers.get(normalizedModel);

    if (cachedTokenizer) {
      return cachedTokenizer;
    }

    try {
      const tokenizer = encodingForModel(normalizedModel as never);
      this.tokenizers.set(normalizedModel, tokenizer);
      return tokenizer;
    } catch {
      const fallbackEncodingName = this.resolveFallbackEncodingName(normalizedModel);
      const cachedFallbackTokenizer = this.tokenizers.get(fallbackEncodingName);

      if (cachedFallbackTokenizer) {
        return cachedFallbackTokenizer;
      }

      try {
        const tokenizer = getEncoding(fallbackEncodingName);
        this.tokenizers.set(fallbackEncodingName, tokenizer);
        return tokenizer;
      } catch {
        return null;
      }
    }
  }

  private resolveFallbackEncodingName(model: string) {
    if (
      model.startsWith("gpt-5")
      || model.startsWith("gpt-4.1")
      || model.startsWith("gpt-4o")
      || model.startsWith("o1")
      || model.startsWith("o3")
      || model.startsWith("o4")
    ) {
      return "o200k_base";
    }

    return "cl100k_base";
  }

  private isUnsupportedEndpointResponse(status: number) {
    return status === 404 || status === 405 || status === 501;
  }

  private markCountEndpointUnsupported() {
    if (this.countEndpointSupport === "unsupported") {
      return;
    }

    this.countEndpointSupport = "unsupported";
    this.logger.warn(
      `Token count endpoint is unavailable at ${this.buildCountEndpointUrl()}. Falling back to local tokenizer counting.`,
    );
  }

  private estimateTokens(messages: readonly ContextTokenMessage[]) {
    return messages.reduce((total, message) => {
      const text = message.text.trim();
      const imageTokenEstimate = (message.images?.length ?? 0) * 256;
      const asciiChars = [...text].filter((character) =>
        character.charCodeAt(0) <= 0x7f,
      ).length;
      const nonAsciiChars = Math.max(0, text.length - asciiChars);
      const textTokenEstimate =
        Math.ceil(asciiChars / 4)
        + Math.ceil(nonAsciiChars * 1.2)
        + 8;

      return total + imageTokenEstimate + textTokenEstimate;
    }, 0);
  }
}
