// 项目上下文和运行能力的静态事实，供 project-context skill 的工具返回给模型。
export const STACK_SUMMARY = {
  backend: ["TypeScript", "NestJS", "LangChain", "LangGraph", "dotenv", "zod"],
  frontend: [
    "TypeScript",
    "React 19",
    "Vite",
    "AI SDK UI",
    "pnpm workspace",
    "shadcn/ui",
  ],
} as const;

// 这些能力描述帮助 Agent 在回答“当前项目能做什么”时使用稳定事实，而不是凭空推断。
export const RUNTIME_CAPABILITIES = [
  "服务端按 NestJS feature modules 组织: Health / Agent / SkillCatalog",
  "Agent 请求先做图片角色识别, 再做顶层意图识别和技能路由",
  "对话执行基于 LangGraph / LangChain, 并带线程级记忆",
  "执行层采用 supervisor + category specialists 的多 Agent 模式",
  "SkillCatalog 覆盖项目上下文、架构设计、内容创作、代码工程和文档生产",
  "服务端使用 Zod 做请求校验",
  "前端通过 AI SDK UI 的流式协议接收消息",
] as const;

// 上下文窗口相关常量：控制长对话摘要、最近消息保留和压缩尝试次数。
export const MAX_PERSISTED_CONVERSATION_MESSAGES = 24;
export const AGENT_CONTEXT_RECENT_MESSAGES_TO_KEEP = 8;
export const AGENT_CONTEXT_MIN_RECENT_MESSAGES_TO_KEEP = 4;
export const AGENT_CONTEXT_MAX_COMPACTION_ATTEMPTS = 3;
export const AGENT_CONTEXT_SUMMARY_MAX_CHARS = 4_000;
