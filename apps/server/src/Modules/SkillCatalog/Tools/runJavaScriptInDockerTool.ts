import { tool } from "@langchain/core/tools";
import { z } from "zod";

import {
  DockerScriptRunnerService,
  formatDockerScriptRunResult,
} from "../Infrastructure/Execution/dockerScriptRunnerService.js";

// Docker 脚本工具的模型入参约束：短脚本、少量参数、短超时、可选只读工作区。
const dockerScriptSchema = z.object({
  args: z.array(z.string().max(200)).max(8).default([]),
  script: z.string().trim().min(1).max(20000),
  timeoutSeconds: z.number().int().min(1).max(15).default(15),
  workspaceAccess: z.enum(["none", "read"]).default("none"),
});

export const createRunJavaScriptInDockerTool = (
  dockerScriptRunner: DockerScriptRunnerService,
) =>
  tool(
    async ({ args, script, timeoutSeconds, workspaceAccess }) =>
      // tool 只做参数转换，安全隔离和执行细节由 DockerScriptRunnerService 统一处理。
      formatDockerScriptRunResult(
        await dockerScriptRunner.runJavaScript({
          args,
          script,
          timeoutMs: timeoutSeconds * 1000,
          workspaceAccess,
        }),
      ),
    {
      description:
        "Run a short JavaScript snippet in an isolated Docker container. No network, no package installation, and only built-in Node.js modules are available. When workspaceAccess is 'read', the current repository is mounted read-only at /workspace.",
      name: "run_javascript_in_docker",
      schema: dockerScriptSchema,
    },
  );
