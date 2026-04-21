import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";
import type { AgentSkillId } from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import type {
  AgentImageRole,
  AgentIntent,
  AgentWorkflowSkillSelection,
} from "../../Domain/agentTypes.js";

const containsAny = (message: string, keywords: readonly string[]) =>
  keywords.some((keyword) => message.includes(keyword));

const FILE_CREATION_KEYWORDS = [
  "create file",
  "create files",
  "write file",
  "write files",
  "save as",
  "export",
  "output file",
  "xlsx",
  "excel",
  "docx",
  "word",
  ".md",
  "markdown",
  ".txt",
  ".js",
  ".py",
  "生成文件",
  "创建文件",
  "写入文件",
  "保存成",
  "导出",
  "落盘",
  "文档文件",
  "表格文件",
] as const;

const LOCATION_KEYWORDS = [
  "高德",
  "amap",
  "地图",
  "导航",
  "路线",
  "路况",
  "位置",
  "地点",
  "地址",
  "经纬度",
  "坐标",
  "poi",
  "周边",
  "附近",
  "地理编码",
  "逆地理编码",
  "公交",
  "驾车",
  "步行",
  "骑行",
] as const;

@Injectable()
export class AgentIntentSkillService {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

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

      if (
        containsAny(normalizedMessage, [
          "workspace",
          "repo",
          "scan",
          "inventory",
          "统计",
          "扫描",
          "目录",
          "批量",
          "文件分布",
          "workspace-inspection",
        ])
      ) {
        skillIds.push("workspace-inspection");
      }

      if (
        containsAny(normalizedMessage, [
          "run",
          "execute",
          "script",
          "sandbox",
          "runtime",
          "python",
          "javascript",
          "js",
          "py",
          "运行",
          "执行",
          "复现",
          "验证",
        ])
      ) {
        skillIds.push("runtime-verification");
      }

      if (
        containsAny(normalizedMessage, [
          "csv",
          "json",
          "yaml",
          "regex",
          "table",
          "log",
          "logs",
          "parse",
          "transform",
          "extract",
          "数据",
          "日志",
          "解析",
          "清洗",
          "转换",
          "提取",
          "正则",
        ])
      ) {
        skillIds.push("data-processing");
      }

      if (containsAny(normalizedMessage, FILE_CREATION_KEYWORDS)) {
        skillIds.push("file-creation");
      }

      if (
        this.config.amapMapsMcpConfigured
        && containsAny(normalizedMessage, LOCATION_KEYWORDS)
      ) {
        skillIds.push("amap-maps");
      }

      return {
        reason:
          skillIds.length > 0
            ? "chat 意图下命中了项目上下文、工作区扫描、脚本执行、文件创建或位置服务相关关键词, 补充相应 skill。"
            : hasImages
              ? `chat 意图下图片角色为 ${imageRole}, 默认直接回答, 不额外挂载专门 skill。`
              : "chat 意图默认直接回答, 不额外挂载专门 skill。",
        skillIds: this.deduplicate(skillIds),
      };
    }

    if (intent === "writing") {
      skillIds.push("content-creation");
      skillIds.push("document-production");

      if (containsAny(normalizedMessage, FILE_CREATION_KEYWORDS)) {
        skillIds.push("file-creation");
      }

      return {
        reason:
          imageRole === "reference"
            ? "writing 意图下图片作为参考素材, 默认走 content-creation -> document-production 固定链路；若命中文件创建关键词则补充 artifact specialist。"
            : "writing 意图默认走 content-creation -> document-production 固定链路；若命中文件创建关键词则补充 artifact specialist。",
        skillIds: this.deduplicate(skillIds),
      };
    }

    if (intent === "coding") {
      skillIds.push("code-engineering");
      skillIds.push("quality-guard");

      if (
        containsAny(normalizedMessage, [
          "run",
          "execute",
          "script",
          "sandbox",
          "runtime",
          "python",
          "javascript",
          "js",
          "py",
          "运行",
          "执行",
          "复现",
          "验证",
          "边界值",
        ])
      ) {
        skillIds.push("runtime-verification");
      }

      if (
        containsAny(normalizedMessage, [
          "csv",
          "json",
          "yaml",
          "regex",
          "table",
          "log",
          "logs",
          "parse",
          "transform",
          "extract",
          "数据",
          "日志",
          "解析",
          "清洗",
          "转换",
          "提取",
          "正则",
        ])
      ) {
        skillIds.push("data-processing");
      }

      if (
        containsAny(normalizedMessage, [
          "workspace",
          "repo",
          "scan",
          "inventory",
          "统计",
          "扫描",
          "目录",
          "批量",
          "文件分布",
          "workspace-inspection",
        ])
      ) {
        skillIds.push("workspace-inspection");
      }

      if (containsAny(normalizedMessage, FILE_CREATION_KEYWORDS)) {
        skillIds.push("file-creation");
      }

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
          ? `coding 意图下图片角色为 ${imageRole}, 默认走 engineering -> quality 固定链路, 并按脚本执行、数据处理、工作区扫描、文件创建、架构和交付关键词补充 skill。`
          : "coding 意图默认走 engineering -> quality 固定链路, 并按脚本执行、数据处理、工作区扫描、文件创建、架构和交付关键词补充 skill。",
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
