import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";
import { DockerScriptRunnerService } from "../Infrastructure/Execution/dockerScriptRunnerService.js";
import { createRunJavaScriptInDockerTool } from "../Tools/runJavaScriptInDockerTool.js";
import { createRunPythonInDockerTool } from "../Tools/runPythonInDockerTool.js";

export const createWorkspaceInspectionSkill = (
  dockerScriptRunner: DockerScriptRunnerService,
): AgentSkillDefinition => ({
  category: "project",
  categoryLabel: "工作区扫描",
  description:
    "用于在只读挂载的工作区里做批量扫描、文件统计、结构化提取和目录级分析。",
  id: "workspace-inspection",
  name: "工作区扫描",
  popularity: "popular",
  routingHints: [
    "workspace",
    "repo",
    "scan",
    "inventory",
    "统计",
    "扫描",
    "目录",
    "批量",
    "文件分布",
    "结构化提取",
  ],
  tags: ["workspace", "repo", "scan", "inventory", "analysis"],
  tools: [
    createRunJavaScriptInDockerTool(dockerScriptRunner),
    createRunPythonInDockerTool(dockerScriptRunner),
  ],
  useCases: [
    "统计仓库里某类文件的数量和分布",
    "扫描目录结构并提取统一格式的信息",
    "对工作区内文件做只读分析并输出摘要",
  ],
});
