import { tool } from "@langchain/core/tools";
import { z } from "zod";

import {
  DockerScriptRunnerService,
  formatDockerScriptRunResult,
} from "../Infrastructure/Execution/dockerScriptRunnerService.js";

const dockerScriptSchema = z.object({
  args: z.array(z.string().max(200)).max(8).default([]),
  script: z.string().trim().min(1).max(20000),
  timeoutSeconds: z.number().int().min(1).max(15).default(15),
  workspaceAccess: z.enum(["none", "read"]).default("none"),
});

export const createRunPythonInDockerTool = (
  dockerScriptRunner: DockerScriptRunnerService,
) =>
  tool(
    async ({ args, script, timeoutSeconds, workspaceAccess }) =>
      formatDockerScriptRunResult(
        await dockerScriptRunner.runPython({
          args,
          script,
          timeoutMs: timeoutSeconds * 1000,
          workspaceAccess,
        }),
      ),
    {
      description:
        "Run a short Python snippet in an isolated Docker container. No network, no package installation, and only the Python standard library is available. When workspaceAccess is 'read', the current repository is mounted read-only at /workspace.",
      name: "run_python_in_docker",
      schema: dockerScriptSchema,
    },
  );
