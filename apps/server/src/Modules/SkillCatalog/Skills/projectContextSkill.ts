import { createDescribeProjectStackTool } from "../Tools/describeProjectStackTool.js";
import { createGetCurrentTimeTool } from "../Tools/getCurrentTimeTool.js";
import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

export const createProjectContextSkill = (): AgentSkillDefinition => ({
  category: "project",
  categoryLabel: "项目上下文",
  description: "用于查询仓库上下文、技术栈和当前时间等基础环境信息。",
  id: "project-context",
  name: "项目上下文",
  popularity: "core",
  routingHints: [
    "项目",
    "仓库",
    "技术栈",
    "context",
    "stack",
    "time",
    "时间",
  ],
  tags: ["project", "context", "stack", "time", "runtime"],
  tools: [createDescribeProjectStackTool(), createGetCurrentTimeTool()],
  useCases: [
    "查看当前项目的后端技术栈",
    "查看当前项目的前端技术栈",
    "查看当前时区时间",
  ],
});
