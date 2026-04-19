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
      skillIds.push("document-production");

      return {
        reason:
          imageRole === "reference"
            ? "writing 意图下图片作为参考素材, 默认走 content-creation -> document-production 固定链路。"
            : "writing 意图默认走 content-creation -> document-production 固定链路。",
        skillIds: this.deduplicate(skillIds),
      };
    }

    if (intent === "coding") {
      skillIds.push("code-engineering");
      skillIds.push("quality-guard");

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

      return {
        reason: hasImages
          ? `coding 意图下图片角色为 ${imageRole}, 默认走 engineering -> quality 固定链路, 并按架构、交付关键词插入前置 specialist。`
          : "coding 意图默认走 engineering -> quality 固定链路, 并按架构、交付关键词插入前置 specialist。",
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
