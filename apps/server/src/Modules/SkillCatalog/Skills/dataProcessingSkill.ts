import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";
import { DockerScriptRunnerService } from "../Infrastructure/Execution/dockerScriptRunnerService.js";
import { createRunJavaScriptInDockerTool } from "../Tools/runJavaScriptInDockerTool.js";
import { createRunPythonInDockerTool } from "../Tools/runPythonInDockerTool.js";

export const createDataProcessingSkill = (
  dockerScriptRunner: DockerScriptRunnerService,
): AgentSkillDefinition => ({
  category: "engineering",
  categoryLabel: "数据处理",
  description:
    "用于处理 CSV、JSON、日志和批量文本，适合做解析、清洗、聚合、抽取和格式转换。",
  id: "data-processing",
  name: "数据处理",
  popularity: "popular",
  routingHints: [
    "csv",
    "json",
    "yaml",
    "regex",
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
  ],
  tags: ["data", "csv", "json", "logs", "transform", "parse"],
  tools: [
    createRunJavaScriptInDockerTool(dockerScriptRunner),
    createRunPythonInDockerTool(dockerScriptRunner),
  ],
  useCases: [
    "解析一段 JSON / CSV / YAML 文本并给出结构化结论",
    "清洗日志样本，抽取错误模式或聚合统计",
    "对一批文本做正则提取、分组和格式转换",
  ],
});
