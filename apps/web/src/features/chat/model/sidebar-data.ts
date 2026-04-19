import {
  Blocks,
  BookOpen,
  Compass,
  FolderKanban,
  MessageSquarePlus,
  Search,
  Sparkles,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";

import type { ConversationPreview } from "@/features/chat/model/types";

export type SidebarAction = {
  id: string;
  icon: LucideIcon;
  label: string;
  prompt?: string;
};

export type StarterPrompt = {
  id: string;
  label: string;
  prompt: string;
};

export const sidebarActions: SidebarAction[] = [
  {
    id: "new-chat",
    icon: MessageSquarePlus,
    label: "新聊天",
  },
  {
    id: "search-chat",
    icon: Search,
    label: "搜索聊天",
    prompt: "请帮我整理当前线程的重点内容和下一步建议。",
  },
];

export const sidebarExploreActions: SidebarAction[] = [
  {
    id: "library",
    icon: BookOpen,
    label: "库",
    prompt: "请为当前 Agent 项目设计一套内部知识库目录结构。",
  },
  {
    id: "apps",
    icon: Blocks,
    label: "应用",
    prompt: "请列出当前项目最值得优先实现的应用模块。",
  },
  {
    id: "research",
    icon: Sparkles,
    label: "深度研究",
    prompt: "请深度分析当前 Agent 项目的下一阶段技术方案和取舍。",
  },
  {
    id: "codex",
    icon: SquareTerminal,
    label: "Codex",
    prompt: "继续以 Codex 协作方式推进当前项目，并给出下一步实现建议。",
  },
  {
    id: "projects",
    icon: FolderKanban,
    label: "项目",
    prompt: "请把当前项目拆成可执行的里程碑和任务清单。",
  },
  {
    id: "discover",
    icon: Compass,
    label: "探索",
    prompt: "请从产品、架构和交互三个层面给我探索这个项目的新方向。",
  },
];

export const starterPrompts: StarterPrompt[] = [
  {
    id: "knowledge",
    label: "公司知识库",
    prompt: "请基于当前项目，设计一个适合内部问答的公司知识库方案。",
  },
  {
    id: "architecture",
    label: "架构建议",
    prompt: "请基于当前技术栈，给我一套适合大项目演进的目录架构方案。",
  },
  {
    id: "roadmap",
    label: "研发路线图",
    prompt: "请给我一个从 MVP 到生产环境的研发路线图和阶段目标。",
  },
];

export const recentConversationSeeds: ConversationPreview[] = [
  {
    id: "seed-langgraph",
    title: "LangGraph TS 装饰器支持",
    meta: "结构扩展",
    prompt: "请分析 LangGraph TS 装饰器支持的实现思路和落地方式。",
  },
  {
    id: "seed-react-md",
    title: "react-markdown 表格支持",
    meta: "前端渲染",
    prompt: "请帮我梳理 react-markdown 表格渲染的兼容方案。",
  },
  {
    id: "seed-node-agent",
    title: "Node.js LangChain Agent 设计",
    meta: "后端编排",
    prompt: "请为 Node.js LangChain Agent 设计一个可扩展的服务端分层方案。",
  },
  {
    id: "seed-virtual-list",
    title: "React 虚拟列表方案",
    meta: "性能优化",
    prompt: "请比较适合聊天页面的 React 虚拟列表方案和接入方式。",
  },
  {
    id: "seed-upload",
    title: "Upload 组件 customRequest",
    meta: "交互细节",
    prompt: "请分析 Upload 组件 customRequest 的实现边界和常见坑位。",
  },
];
