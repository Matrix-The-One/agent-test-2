import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";

const DOCKER_TMPFS_MOUNT = "/tmp:rw,noexec,nosuid,size=64m";
const EMPTY_OUTPUT_LABEL = "(empty)";
const MAX_SCRIPT_ARGS = 8;

export type DockerScriptLanguage = "javascript" | "python";
export type DockerWorkspaceAccess = "none" | "read";
export type DockerScriptRunStatus =
  | "success"
  | "nonzero_exit"
  | "timeout"
  | "unavailable"
  | "failed_to_start";

export type DockerScriptRunResult = {
  durationMs: number;
  exitCode: number | null;
  image: string;
  language: DockerScriptLanguage;
  status: DockerScriptRunStatus;
  stderr: string;
  stdout: string;
  timeoutMs: number;
  truncated: boolean;
  workspaceAccess: DockerWorkspaceAccess;
  workspaceRoot?: string;
};

export type DockerScriptRunInput = {
  args?: string[];
  language: DockerScriptLanguage;
  script: string;
  timeoutMs?: number;
  workspaceAccess?: DockerWorkspaceAccess;
};

const formatOutput = (value: string) => {
  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : EMPTY_OUTPUT_LABEL;
};

const appendOutputChunk = ({
  current,
  maxChars,
  nextChunk,
}: {
  current: string;
  maxChars: number;
  nextChunk: Buffer;
}) => {
  if (current.length >= maxChars) {
    return {
      next: current,
      truncated: true,
    };
  }

  const availableChars = maxChars - current.length;
  const chunkText = nextChunk.toString("utf8");
  const appendedChunk = chunkText.slice(0, availableChars);

  return {
    next: `${current}${appendedChunk}`,
    truncated: appendedChunk.length < chunkText.length,
  };
};

@Injectable()
export class DockerScriptRunnerService {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  async runJavaScript(input: Omit<DockerScriptRunInput, "language">) {
    return this.runScript({
      ...input,
      language: "javascript",
    });
  }

  async runPython(input: Omit<DockerScriptRunInput, "language">) {
    return this.runScript({
      ...input,
      language: "python",
    });
  }

  async runScript(input: DockerScriptRunInput): Promise<DockerScriptRunResult> {
    const startedAtMs = Date.now();
    const timeoutMs = Math.min(
      input.timeoutMs ?? this.config.agentDockerTimeoutMs,
      this.config.agentDockerTimeoutMs,
    );
    const workspaceAccess = input.workspaceAccess ?? "none";

    if (!this.config.dockerConfigured) {
      return {
        durationMs: Date.now() - startedAtMs,
        exitCode: null,
        image: this.getImage(input.language),
        language: input.language,
        status: "unavailable",
        stderr:
          "Docker execution is disabled. Set DOCKER_ENABLED=true to enable JS/Python script tools.",
        stdout: "",
        timeoutMs,
        truncated: false,
        workspaceAccess,
      };
    }

    const workspaceRoot =
      workspaceAccess === "read" ? await this.resolveWorkspaceRoot() : undefined;

    if (workspaceAccess === "read" && !workspaceRoot) {
      return {
        durationMs: Date.now() - startedAtMs,
        exitCode: null,
        image: this.getImage(input.language),
        language: input.language,
        status: "unavailable",
        stderr:
          "Workspace read mount is unavailable because AGENT_DOCKER_WORKSPACE_ROOT does not point to a readable directory.",
        stdout: "",
        timeoutMs,
        truncated: false,
        workspaceAccess,
      };
    }

    const jobDirectory = await mkdtemp(join(tmpdir(), "agent-docker-"));
    const containerName = `agent-tool-${randomUUID().replace(/-/g, "")}`;
    const entryFileName = input.language === "javascript" ? "main.mjs" : "main.py";

    try {
      await writeFile(join(jobDirectory, entryFileName), input.script, "utf8");

      return await this.executeDockerRun({
        args: input.args?.slice(0, MAX_SCRIPT_ARGS) ?? [],
        containerName,
        entryFileName,
        image: this.getImage(input.language),
        jobDirectory,
        language: input.language,
        startedAtMs,
        timeoutMs,
        workspaceAccess,
        workspaceRoot,
      });
    } finally {
      await rm(jobDirectory, {
        force: true,
        recursive: true,
      });
    }
  }

  private async executeDockerRun({
    args,
    containerName,
    entryFileName,
    image,
    jobDirectory,
    language,
    startedAtMs,
    timeoutMs,
    workspaceAccess,
    workspaceRoot,
  }: {
    args: string[];
    containerName: string;
    entryFileName: string;
    image: string;
    jobDirectory: string;
    language: DockerScriptLanguage;
    startedAtMs: number;
    timeoutMs: number;
    workspaceAccess: DockerWorkspaceAccess;
    workspaceRoot?: string;
  }): Promise<DockerScriptRunResult> {
    const dockerArgs = [
      "run",
      "--rm",
      "--init",
      "--name",
      containerName,
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "128",
      "--memory",
      "512m",
      "--cpus",
      "1",
      "--user",
      "65532:65532",
      "--mount",
      `type=bind,source=${jobDirectory},target=/job,readonly`,
      "--tmpfs",
      DOCKER_TMPFS_MOUNT,
      "-e",
      "HOME=/tmp",
      "-e",
      "PYTHONDONTWRITEBYTECODE=1",
      ...(workspaceRoot
        ? ["--mount", `type=bind,source=${workspaceRoot},target=/workspace,readonly`]
        : []),
      "-w",
      "/job",
      image,
      ...(language === "javascript"
        ? ["node", `/job/${entryFileName}`]
        : ["python", `/job/${entryFileName}`]),
      ...args,
    ];

    return await new Promise<DockerScriptRunResult>((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let truncated = false;
      let timedOut = false;
      let timeoutHandle: NodeJS.Timeout | undefined;

      const finalize = (result: Omit<DockerScriptRunResult, "language" | "timeoutMs">) => {
        if (settled) {
          return;
        }

        settled = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        resolve({
          ...result,
          language,
          timeoutMs,
        });
      };

      const child = spawn(this.config.dockerBin, dockerArgs, {
        shell: false,
        windowsHide: true,
      });

      timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill();
        void this.forceRemoveContainer(containerName);
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        const nextState = appendOutputChunk({
          current: stdout,
          maxChars: this.config.agentDockerMaxOutputChars,
          nextChunk: chunk,
        });

        stdout = nextState.next;
        truncated ||= nextState.truncated;
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const nextState = appendOutputChunk({
          current: stderr,
          maxChars: this.config.agentDockerMaxOutputChars,
          nextChunk: chunk,
        });

        stderr = nextState.next;
        truncated ||= nextState.truncated;
      });

      child.on("error", (error) => {
        finalize({
          durationMs: Date.now() - startedAtMs,
          exitCode: null,
          image,
          status: "failed_to_start",
          stderr: `Failed to start Docker: ${error.message}`,
          stdout,
          truncated,
          workspaceAccess,
          ...(workspaceRoot ? { workspaceRoot } : {}),
        });
      });

      child.on("close", (exitCode) => {
        finalize({
          durationMs: Date.now() - startedAtMs,
          exitCode,
          image,
          status: timedOut
            ? "timeout"
            : exitCode === 0
              ? "success"
              : "nonzero_exit",
          stderr,
          stdout,
          truncated,
          workspaceAccess,
          ...(workspaceRoot ? { workspaceRoot } : {}),
        });
      });
    });
  }

  private async resolveWorkspaceRoot() {
    try {
      const workspaceRoot = this.config.agentDockerWorkspaceRoot;
      const workspaceRootStat = await stat(workspaceRoot);

      if (!workspaceRootStat.isDirectory()) {
        return undefined;
      }

      return workspaceRoot;
    } catch {
      return undefined;
    }
  }

  private getImage(language: DockerScriptLanguage) {
    return language === "javascript"
      ? this.config.agentDockerJavaScriptImage
      : this.config.agentDockerPythonImage;
  }

  private async forceRemoveContainer(containerName: string) {
    await new Promise<void>((resolve) => {
      const cleanupProcess = spawn(
        this.config.dockerBin,
        ["rm", "-f", containerName],
        {
          shell: false,
          stdio: "ignore",
          windowsHide: true,
        },
      );

      cleanupProcess.on("error", () => resolve());
      cleanupProcess.on("close", () => resolve());
    });
  }
}

export const formatDockerScriptRunResult = (result: DockerScriptRunResult) =>
  [
    "Docker script execution result",
    `Language: ${result.language}`,
    `Status: ${result.status}`,
    `Image: ${result.image}`,
    `Duration ms: ${result.durationMs}`,
    `Exit code: ${result.exitCode ?? "n/a"}`,
    `Workspace access: ${result.workspaceAccess === "read" ? "read-only at /workspace" : "none"}`,
    ...(result.workspaceRoot ? [`Workspace root: ${result.workspaceRoot}`] : []),
    `Output truncated: ${result.truncated ? "yes" : "no"}`,
    "Stdout:",
    formatOutput(result.stdout),
    "Stderr:",
    formatOutput(result.stderr),
  ].join("\n");
