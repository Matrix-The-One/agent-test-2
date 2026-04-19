import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  AGENT_INTENTS,
  type AgentIntentDecision,
} from "../../domain/agent.types.js";
import { AgentModelFactory } from "../../infrastructure/factories/agent-model.factory.js";

const agentIntentSchema = z.object({
  intent: z.enum(AGENT_INTENTS),
  reason: z.string().min(1),
});

@Injectable()
export class AgentIntentService {
  @Inject(AgentModelFactory)
  private readonly modelFactory!: AgentModelFactory;

  async recognize(message: string): Promise<AgentIntentDecision> {
    try {
      const model = this.modelFactory
        .createRouterModel()
        .withStructuredOutput(agentIntentSchema);

      const result = await model.invoke([
        new SystemMessage(
          [
            "你是一个 agent 请求意图识别器，只能返回 direct-answer 或 skill-routing 两种意图。",
            "direct-answer: 普通问答、闲聊、解释说明、简单跟进，不需要预先筛选 skill。",
            "skill-routing: 代码实现、架构设计、测试质量、文档生产、文件生成、项目分析等需要领域 skill 的请求。",
            "如果请求明显涉及实现、修改、排查、设计、规划、生成文档或处理工程文件，优先选择 skill-routing。",
            "不要输出多余解释，只给结构化结果。",
          ].join("\n"),
        ),
        new HumanMessage(`用户请求：\n${message}`),
      ]);

      return {
        intent: result.intent,
        reason: result.reason,
      };
    } catch {
      return this.fallbackDecision(message);
    }
  }

  private fallbackDecision(message: string): AgentIntentDecision {
    const normalizedMessage = message.trim().toLowerCase();

    const directAnswerHints = [
      "你好",
      "hello",
      "hi",
      "thanks",
      "谢谢",
      "你是谁",
      "早上好",
      "晚上好",
    ];

    const skillRoutingHints = [
      "实现",
      "开发",
      "改造",
      "重构",
      "设计",
      "测试",
      "排查",
      "修复",
      "报错",
      "bug",
      "代码",
      "模块",
      "服务",
      "接口",
      "文档",
      "pdf",
      "word",
      "excel",
      "skill",
      "agent",
    ];

    if (skillRoutingHints.some((item) => normalizedMessage.includes(item))) {
      return {
        intent: "skill-routing",
        reason: "请求包含明显的工程实现或领域任务信号，需要先路由 skill。",
      };
    }

    if (directAnswerHints.some((item) => normalizedMessage.includes(item))) {
      return {
        intent: "direct-answer",
        reason: "请求更接近普通对话或简单说明，可直接回答。",
      };
    }

    return {
      intent: "direct-answer",
      reason: "未检测到必须预路由 skill 的强信号，默认直接回答。",
    };
  }
}

