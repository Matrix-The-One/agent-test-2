import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";
import { DockerScriptRunnerService } from "../Infrastructure/Execution/dockerScriptRunnerService.js";
import { createRunJavaScriptInDockerTool } from "../Tools/runJavaScriptInDockerTool.js";
import { createRunPythonInDockerTool } from "../Tools/runPythonInDockerTool.js";

export const createRuntimeVerificationSkill = (
  dockerScriptRunner: DockerScriptRunnerService,
): AgentSkillDefinition => ({
  category: "engineering",
  categoryLabel: "运行时验证",
  description:
    "用于在隔离容器里执行短小 JS / Python 代码片段，做逻辑验证、复现问题和确定性计算。",
  id: "runtime-verification",
  name: "运行时验证",
  popularity: "popular",
  routingHints: [
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
  ],
  tags: ["runtime", "script", "verification", "sandbox", "python", "javascript"],
  tools: [
    createRunJavaScriptInDockerTool(dockerScriptRunner),
    createRunPythonInDockerTool(dockerScriptRunner),
  ],
  useCases: [
    "运行一段 JavaScript 验证某段逻辑是否按预期工作",
    "运行一段 Python 复现边界值或异常路径",
    "执行确定性计算并把输出回传给 supervisor",
  ],
});
