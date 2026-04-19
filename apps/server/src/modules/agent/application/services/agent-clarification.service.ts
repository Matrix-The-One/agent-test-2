import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import type { AgentClarificationDecision } from "../../domain/agent.types.js";
import { AgentModelFactory } from "../../infrastructure/factories/agent-model.factory.js";

const clarificationSchema = z.object({
  needClarification: z.boolean(),
  question: z.string().default(""),
  reason: z.string().min(1),
  suggestions: z.array(z.string()).max(3).default([]),
  title: z.string().default("还需要确认一下"),
});

type ClarificationDecision = z.infer<typeof clarificationSchema>;

@Injectable()
export class AgentClarificationService {
  @Inject(AgentModelFactory)
  private readonly modelFactory!: AgentModelFactory;

  async evaluate(message: string): Promise<AgentClarificationDecision> {
    try {
      const model = this.modelFactory
        .createRouterModel()
        .withStructuredOutput(clarificationSchema);

      const result = await model.invoke([
        new SystemMessage(
          [
            "你是一个请求澄清判断器，负责判断当前用户问题是否缺少关键上下文。",
            "只有在缺少关键信息且不同答案会明显改变实现方案时，才要求澄清。",
            "如果可以基于当前上下文和合理默认值继续回答，就不要追问。",
            "如果需要追问，只生成一个最关键、最直接的中文问题。",
            "如果需要追问，同时给出 2 到 3 条可直接发送的中文补充示例，示例要站在用户口吻。",
            "title 使用简短中文标题，例如“还需要确认一下”。",
            "不要一次问多个问题，不要输出冗长解释。",
          ].join("\n"),
        ),
        new HumanMessage(`用户请求：\n${message}`),
      ]);

      if (!result.needClarification) {
        return {
          needClarification: false,
          question: "",
          reason: result.reason,
          suggestions: [],
          title: "",
        };
      }

      return {
        needClarification: true,
        question: (result.question ?? "").trim(),
        reason: result.reason,
        suggestions: (result.suggestions ?? [])
          .map((item) => item.trim())
          .filter(Boolean),
        title: (result.title ?? "还需要确认一下").trim(),
      };
    } catch {
      return this.fallbackDecision(message);
    }
  }

  private fallbackDecision(message: string): AgentClarificationDecision {
    const normalizedMessage = message.trim().toLowerCase();

    const ambiguousMessages = [
      "怎么做",
      "怎么实现",
      "继续",
      "展开",
      "细说",
      "改一下",
      "优化一下",
      "这个怎么弄",
    ];

    if (
      normalizedMessage.length <= 6 ||
      ambiguousMessages.some((item) => normalizedMessage === item)
    ) {
      return {
        needClarification: true,
        question: "你希望我优先处理哪一部分？可以直接说目标、范围或想改的模块。",
        reason: "用户请求过短，缺少足够的目标和范围信息。",
        suggestions: [
          "我想先做服务端的 skill 路由。",
          "先帮我改前端确认询问 UI。",
          "目标是把当前 agent 改成多轮可追问流程。",
        ],
        title: "还需要确认一下",
      };
    }

    return {
      needClarification: false,
      question: "",
      reason: "当前信息足够继续执行。",
      suggestions: [],
      title: "",
    };
  }
}
