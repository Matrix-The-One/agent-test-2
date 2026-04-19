import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentSkillDefinition } from "../domain/agent-skill.types.js";

const createSuggestAgentArchitectureTool = () =>
  tool(
    async ({ goal, style }) => {
      const styleGuidance =
        style === "minimal"
          ? "尽量保持架构轻薄，便于快速演进。"
          : "建议显式拆分入口、编排、记忆、观测和 skill catalog。";

      return [
        `面向“${goal}”的推荐 agent 架构：`,
        styleGuidance,
        "- 入口层：由 HTTP controller 或 transport adapter 接收聊天请求。",
        "- 应用层：统一处理澄清、路由、执行编排和流式输出。",
        "- Skill 路由层：先用快速模型为当前请求挑选相关 skills。",
        "- Skill Catalog：每个 skill 以元数据加工具列表的形式注册。",
        "- 执行层：主 LangGraph/LangChain agent 只拿到本轮命中的工具。",
        "- 记忆层：通过 thread-based checkpointer 持久化多轮消息。",
        "- 扩展路径：新增 skill 时不需要改 controller 协议和路由硬编码。",
      ].join("\n");
    },
    {
      description:
        "为给定目标生成 agent 架构建议，覆盖路由、工具、记忆和执行层。",
      name: "solution_architecture_suggest_agent_architecture",
      schema: z.object({
        goal: z.string().min(1),
        style: z.enum(["minimal", "layered"]).default("layered"),
      }),
    },
  );

const createSuggestDirectoryStructureTool = () =>
  tool(
    async ({ goal, includeShared }) => {
      const sharedBlock = includeShared
        ? [
            "      shared/",
            "        pipes/",
            "        filters/",
            "      config/",
          ]
        : [];

      return [
        `面向“${goal}”的建议目录结构：`,
        "apps/",
        "  server/",
        "    src/",
        "      modules/",
        "        agent/",
        "          presentation/http/",
        "          application/services/",
        "          domain/",
        "          infrastructure/factories/",
        "        skill-catalog/",
        "          presentation/http/",
        "          application/services/",
        "          domain/",
        "          skills/",
        "          tools/",
        "        health/",
        "          presentation/http/",
        ...sharedBlock,
        "  web/",
        "    src/",
        "      App.tsx",
        "      components/",
        "      lib/",
      ].join("\n");
    },
    {
      description: "为 agent 应用或某个功能域给出目录结构建议。",
      name: "solution_architecture_suggest_directory_structure",
      schema: z.object({
        goal: z.string().min(1),
        includeShared: z.boolean().default(true),
      }),
    },
  );

export const createSolutionArchitectureSkill = (): AgentSkillDefinition => ({
  category: "architecture",
  categoryLabel: "方案架构",
  description:
    "用于系统设计、模块边界、目录结构，以及多 skill agent 能力的组织方式设计。",
  id: "solution-architecture",
  name: "方案架构",
  popularity: "core",
  routingHints: [
    "架构",
    "目录",
    "模块",
    "分层",
    "设计",
    "workflow",
    "skill",
    "router",
    "服务端",
    "server",
  ],
  tags: ["architecture", "modules", "routing", "nest"],
  tools: [
    createSuggestAgentArchitectureTool(),
    createSuggestDirectoryStructureTool(),
  ],
  useCases: [
    "设计多 skill agent 服务结构",
    "规划目录、模块或分层架构",
    "解释路由层与执行层如何解耦",
  ],
});
