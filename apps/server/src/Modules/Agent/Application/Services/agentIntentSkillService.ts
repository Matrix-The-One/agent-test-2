import { Injectable } from "@nestjs/common";

import type { AgentSkillId } from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import type {
  AgentImageRole,
  AgentIntent,
  AgentWorkflowSkillSelection,
} from "../../Domain/agentTypes.js";

const containsAny = (message: string, keywords: readonly string[]) =>
  keywords.some((keyword) => message.includes(keyword));

@Injectable()
export class AgentIntentSkillService {
  resolve({
    hasImages,
    imageRole,
    intent,
    message,
  }: {
    hasImages: boolean;
    imageRole: AgentImageRole;
    intent: AgentIntent;
    message: string;
  }): AgentWorkflowSkillSelection {
    const normalizedMessage = message.trim().toLowerCase();
    const skillIds: AgentSkillId[] = [];

    if (intent === "chat") {
      if (
        containsAny(normalizedMessage, [
          "项目",
          "技术栈",
          "上下文",
          "当前仓库",
          "platform",
          "stack",
          "context",
          "time",
          "时间",
          "架构",
        ])
      ) {
        skillIds.push("project-context");
      }

      return {
        reason:
          skillIds.length > 0
            ? "chat 意图下命中了项目上下文相关关键词, 补充 project-context skill。"
            : hasImages
              ? `chat 意图下图片角色为 ${imageRole}, 默认直接回答, 不额外挂载专门 skill。`
              : "chat 意图默认直接回答, 不额外挂载专门 skill。",
        skillIds,
      };
    }

    if (intent === "writing") {
      skillIds.push("content-creation");

      if (
        containsAny(normalizedMessage, [
          "word",
          "pdf",
          "docx",
          "文档",
          "报告",
          "方案书",
          "交付件",
          "模板",
        ])
      ) {
        skillIds.push("document-production");
      }

      return {
        reason:
          imageRole === "reference"
            ? "writing 意图下图片作为参考素材, 挂载 content-creation, 并按文档输出关键词补充 document-production。"
            : "writing 意图默认挂载 content-creation, 并按文档输出关键词补充 document-production。",
        skillIds: this.deduplicate(skillIds),
      };
    }

    if (intent === "coding") {
      skillIds.push("code-engineering");

      if (
        containsAny(normalizedMessage, ["架构", "设计", "模块划分", "目录结构", "分层"])
      ) {
        skillIds.push("solution-architecture");
      }

      if (
        containsAny(normalizedMessage, [
          "计划",
          "排期",
          "分阶段",
          "里程碑",
          "拆分任务",
          "roadmap",
        ])
      ) {
        skillIds.push("delivery-planning");
      }

      if (
        containsAny(normalizedMessage, ["测试", "review", "评审", "质量", "回归", "风险"])
      ) {
        skillIds.push("quality-guard");
      }

      return {
        reason: hasImages
          ? `coding 意图下图片角色为 ${imageRole}, 默认挂载 code-engineering, 并按架构、交付、质量关键词补充相关 skill。`
          : "coding 意图默认挂载 code-engineering, 并按架构、交付、质量关键词补充相关 skill。",
        skillIds: this.deduplicate(skillIds),
      };
    }

    return {
      reason: "image 意图当前不挂载文本 skill。",
      skillIds: [],
    };
  }

  private deduplicate(skillIds: readonly AgentSkillId[]): AgentSkillId[] {
    return Array.from(new Set(skillIds));
  }
}
