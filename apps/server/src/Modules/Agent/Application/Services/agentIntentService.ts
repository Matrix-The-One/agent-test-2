import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import { AppConfigService } from "../../../../Config/appConfigService.js";
import { AgentModelFactory } from "../../Infrastructure/Factories/agentModelFactory.js";
import type {
  AgentImageRole,
  AgentIntentDecision,
  AgentRequestMode,
} from "../../Domain/agentTypes.js";
import { AGENT_INTENTS } from "../../Domain/agentTypes.js";

const imageOutputKeywords = [
  "画一张",
  "生成一张",
  "生成图片",
  "做一张图",
  "设计一张",
  "给我一张",
  "配图",
  "出图",
  "绘制",
  "海报",
  "插画",
  "封面图",
  "logo",
  "draw",
  "generate image",
  "create image",
  "image generation",
] as const;

const codingKeywords = [
  "代码",
  "写代码",
  "编码",
  "开发",
  "实现",
  "修复",
  "重构",
  "报错",
  "bug",
  "debug",
  "接口",
  "api",
  "模块",
  "服务",
  "函数",
  "前端",
  "后端",
  "页面",
  "组件",
  "日志",
  "typescript",
  "javascript",
  "nestjs",
  "react",
  "vue",
  "sql",
  "脚本",
] as const;

const writingKeywords = [
  "文章",
  "写作",
  "写一篇",
  "博客",
  "文案",
  "公众号",
  "宣传稿",
  "新闻稿",
  "摘要",
  "总结",
  "大纲",
  "标题",
  "润色",
  "改写",
  "作文",
  "报告",
  "方案",
  "write",
  "article",
  "blog",
  "copywriting",
  "rewrite",
] as const;

const intentRoutingHints = [
  "帮我",
  "请",
  "给我",
  "做",
  "起草",
  "整理",
  "梳理",
  "规划",
  "设计",
  "分析",
  "说明",
  "输出",
  "生成",
  "制作",
  "修改",
  "优化",
  "review",
  "plan",
  "draft",
  "create",
  "generate",
  "design",
  "write",
  "analyze",
  "refactor",
] as const;

const intentRouterSchema = z.object({
  intent: z.enum(AGENT_INTENTS),
  reason: z.string().trim().min(1).max(200),
});

const INTENT_ROUTER_SYSTEM_PROMPT = `
你是 Agent 的顶层意图路由器。
你只能从 chat, writing, coding, image 四个意图里选择一个。

意图定义:
- chat: 普通聊天, 问答, 解释, 分析, 或基于文本/图片给出文字回答
- writing: 文章, 文案, 摘要, 润色, 改写, 报告, 方案等文字创作
- coding: 代码实现, 调试, 修复报错, 架构设计, 接口开发, 脚本编写
- image: 生成图片, 改图, 局部编辑, 风格迁移, 海报, logo, 插画等视觉产出

补充规则:
- 用户上传图片但目标是分析图片、解释图片、或基于图片做文字回答, 通常属于 chat
- imageRole=edit 时, 优先判为 image
- imageRole=reference 只有在目标是产出新图片时, 才判为 image
- 不确定时, 优先按用户最终想得到的交付物判断

只输出结构化结果, 不要附加额外说明。`.trim();

const containsAny = (message: string, keywords: readonly string[]) =>
  keywords.some((keyword) => message.includes(keyword));

type IntentRuleResult =
  | {
      decision: AgentIntentDecision;
      shouldUseModel: false;
    }
  | {
      decision: AgentIntentDecision;
      shouldUseModel: true;
    };

@Injectable()
export class AgentIntentService {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  @Inject(AgentModelFactory)
  private readonly modelFactory!: AgentModelFactory;

  async recognize({
    hasImages,
    imageRole,
    message,
    requestedMode,
  }: {
    hasImages: boolean;
    imageRole: AgentImageRole;
    message: string;
    requestedMode?: AgentRequestMode;
  }): Promise<AgentIntentDecision> {
    if (requestedMode) {
      return {
        intent: requestedMode,
        reason: `请求显式指定了 mode=${requestedMode}, 直接按该模式处理。`,
      };
    }

    const normalizedMessage = message.trim().toLowerCase();
    const ruleResult = this.recognizeByRules({
      hasImages,
      imageRole,
      message: normalizedMessage,
    });

    if (!ruleResult.shouldUseModel) {
      return ruleResult.decision;
    }

    if (!this.config.providerConfigured) {
      return {
        ...ruleResult.decision,
        reason: `${ruleResult.decision.reason} 当前未配置可用模型, 使用规则结果作为最终意图。`,
      };
    }

    const modelDecision = await this.recognizeByModel({
      hasImages,
      imageRole,
      message,
    }).catch(() => null);

    if (modelDecision) {
      return modelDecision;
    }

    return {
      ...ruleResult.decision,
      reason: `${ruleResult.decision.reason} 结构化意图识别失败, 已回退到规则结果。`,
    };
  }

  private recognizeByRules({
    hasImages,
    imageRole,
    message,
  }: {
    hasImages: boolean;
    imageRole: AgentImageRole;
    message: string;
  }): IntentRuleResult {
    const matches: AgentIntentDecision[] = [];

    if (imageRole === "edit") {
      return {
        decision: {
          intent: "image",
          reason: "图片角色识别为 edit, 直接按图片生成或编辑意图处理。",
        },
        shouldUseModel: false,
      };
    }

    if (containsAny(message, codingKeywords) || message.includes("```")) {
      matches.push({
        intent: "coding",
        reason: "命中了代码实现或工程修改相关关键词, 归类为 coding。",
      });
    }

    if (containsAny(message, writingKeywords)) {
      matches.push({
        intent: "writing",
        reason: "命中了文章写作或文案编辑相关关键词, 归类为 writing。",
      });
    }

    if (containsAny(message, imageOutputKeywords)) {
      matches.push({
        intent: "image",
        reason: "文本包含明确的出图指令, 归类为 image。",
      });
    }

    if (matches.length === 1) {
      return {
        decision: matches[0],
        shouldUseModel: false,
      };
    }

    if (matches.length > 1) {
      return {
        decision: {
          ...matches[0],
          reason: `同时命中了多个候选意图(${matches.map((match) => match.intent).join(", ")}), 需要交给模型进一步判断。当前回退优先级结果为 ${matches[0].intent}。`,
        },
        shouldUseModel: true,
      };
    }

    if (!message) {
      return {
        decision: {
          intent: "chat",
          reason: hasImages
            ? "请求只包含图片或空文本, 默认按带图片上下文的 chat 处理。"
            : "请求未包含有效文本, 默认按 chat 处理。",
        },
        shouldUseModel: false,
      };
    }

    if (!this.shouldUseModelForAmbiguousMessage({ hasImages, message })) {
      return {
        decision: {
          intent: "chat",
          reason: hasImages
            ? "请求携带图片, 但未命中写作、代码或出图规则, 默认按 chat 处理。"
            : "未命中特定创作或工程规则, 默认按 chat 处理。",
        },
        shouldUseModel: false,
      };
    }

    return {
      decision: {
        intent: "chat",
        reason: hasImages
          ? "请求携带图片且文本未命中强规则, 先默认回退到 chat, 再交给模型进一步判断。"
          : "文本未命中强规则, 先默认回退到 chat, 再交给模型进一步判断。",
      },
      shouldUseModel: true,
    };
  }

  private shouldUseModelForAmbiguousMessage({
    hasImages,
    message,
  }: {
    hasImages: boolean;
    message: string;
  }) {
    if (hasImages && message.length >= 4) {
      return true;
    }

    if (message.length >= 30) {
      return true;
    }

    return message.length >= 8 && containsAny(message, intentRoutingHints);
  }

  private async recognizeByModel({
    hasImages,
    imageRole,
    message,
  }: {
    hasImages: boolean;
    imageRole: AgentImageRole;
    message: string;
  }): Promise<AgentIntentDecision> {
    const structuredModel = this.modelFactory
      .createIntentModel()
      .withStructuredOutput(intentRouterSchema);
    const result = await structuredModel.invoke([
      new SystemMessage(INTENT_ROUTER_SYSTEM_PROMPT),
      new HumanMessage(this.buildIntentRouterInput({ hasImages, imageRole, message })),
    ]);

    return {
      intent: result.intent,
      reason: `结构化意图识别结果为 ${result.intent}: ${result.reason}`,
    };
  }

  private buildIntentRouterInput({
    hasImages,
    imageRole,
    message,
  }: {
    hasImages: boolean;
    imageRole: AgentImageRole;
    message: string;
  }) {
    return [
      "请判断下面请求的顶层意图:",
      `- hasImages: ${hasImages ? "true" : "false"}`,
      `- imageRole: ${imageRole}`,
      `- message: ${message.trim() || "(empty)"}`,
    ].join("\n");
  }
}
