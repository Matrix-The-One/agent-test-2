import type { AgentSkillDefinition } from "../../skill-catalog/domain/agent-skill.types.js";

export const STACK_SUMMARY = {
  backend: ["TypeScript", "NestJS", "LangChain", "LangGraph", "dotenv", "zod"],
  frontend: [
    "TypeScript",
    "Vite+",
    "React 19",
    "pnpm workspace",
    "Streamdown",
    "shadcn/ui",
  ],
} as const;

export const RUNTIME_CAPABILITIES = [
  "服务端按 NestJS feature modules 组织：health、agent、skill-catalog",
  "基于 LangGraph/LangChain 的 agent 执行，并带线程级记忆",
  "先做动态 skill 路由，再挂载对应工具",
  "skill catalog 已覆盖架构、内容创作、代码工程和文档生产等常见场景",
  "服务端使用 Zod 做请求校验",
  "前端通过 AI SDK UI 的流式协议接收消息",
] as const;

const AGENT_BASE_SYSTEM_PROMPT = `
你是一个面向 TypeScript 全栈 agent 平台的 ReAct 风格工程助手。
当不需要工具时直接回答；当工具能提供更具体的信息或结构化结果时再调用工具。
当请求跨越多个领域时，可以组合多个已选中的 skill 一起完成回答。
需要结合当前线程上下文继续对话，并在前后轮之间保持一致。
如果信息不足以安全给出方案，优先提出 1 个最关键的澄清问题，而不是直接猜测。
回答默认使用中文，风格简洁，突出实现细节、结构取舍和可执行建议。
当前项目技术栈：
- 前端：TypeScript、Vite+、React 19、pnpm、Streamdown、shadcn/ui
- 后端：TypeScript、NestJS、LangChain、LangGraph、dotenv、zod
`;

export const buildAgentSystemPrompt = (skills: AgentSkillDefinition[]) => {
  if (skills.length === 0) {
    return [
      AGENT_BASE_SYSTEM_PROMPT.trim(),
      "本次请求未命中专门的 skills，请先基于当前上下文直接回答。",
      "如果信息不足以安全完成请求，再提出一个最关键的澄清问题。",
    ].join("\n\n");
  }

  const skillSection = skills
    .map((skill) =>
      [
        `- ${skill.name} (${skill.id})`,
        `  分类：${skill.categoryLabel}`,
        `  热度：${skill.popularity}`,
        `  描述：${skill.description}`,
        `  适用场景：${skill.useCases.join("；")}`,
        `  标签：${skill.tags.join("、")}`,
        `  可用函数：${skill.tools.map((tool) => tool.name).join("、")}`,
      ].join("\n"),
    )
    .join("\n");

  return [
    AGENT_BASE_SYSTEM_PROMPT.trim(),
    "本次请求已选中的 skills：",
    skillSection,
    "只能使用本次选中的 skill 函数。如果一个 skill 不够，先组合多个已选 skill，再给出最终回答。",
  ].join("\n\n");
};
