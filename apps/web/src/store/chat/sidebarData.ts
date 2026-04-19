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

import type {
  ChatRequestMode,
  ConversationPreview,
} from "@/store/chat/types";

export type SidebarAction = {
  id: string;
  icon: LucideIcon;
  label: string;
  mode?: ChatRequestMode;
  prompt?: string;
};

export type StarterPrompt = {
  id: string;
  label: string;
  mode?: ChatRequestMode;
  prompt: string;
};

export type ChatModeOption = {
  helperText: string;
  id: string;
  label: string;
  mode: ChatRequestMode;
  placeholder: string;
};

export const chatModeOptions: ChatModeOption[] = [
  {
    helperText: "已选择聊天回答模式，发送时会优先按问答、分析或解释处理。",
    id: "chat",
    label: "聊天回答",
    mode: "chat",
    placeholder: "问一个问题，或让 Agent 基于文本和图片做分析",
  },
  {
    helperText: "已选择文章编写模式，发送时会优先按写作、润色、提纲和总结处理。",
    id: "writing",
    label: "文章编写",
    mode: "writing",
    placeholder: "描述你要写的文章、提纲、文案或需要润色的内容",
  },
  {
    helperText: "已选择代码编写模式，发送时会优先按实现、排错、重构和架构设计处理。",
    id: "coding",
    label: "代码编写",
    mode: "coding",
    placeholder: "描述你的代码需求、报错信息、接口改造或架构问题",
  },
  {
    helperText: "已选择制作图片模式，发送时会优先按出图或改图需求处理。",
    id: "image",
    label: "制作图片",
    mode: "image",
    placeholder: "描述你要生成的图片、风格、尺寸，或说明如何修改现有图片",
  },
];

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
  },
];

export const sidebarExploreActions: SidebarAction[] = [
  {
    id: "library",
    icon: BookOpen,
    label: "库",
    mode: "writing",
    prompt: "请为当前 Agent 项目设计一套内部知识库目录结构。",
  },
  {
    id: "apps",
    icon: Blocks,
    label: "应用",
    mode: "chat",
    prompt: "请列出当前项目最值得优先实现的应用模块。",
  },
  {
    id: "research",
    icon: Sparkles,
    label: "深度研究",
    mode: "chat",
    prompt: "请深度分析当前 Agent 项目的下一阶段技术方案和取舍。",
  },
  {
    id: "codex",
    icon: SquareTerminal,
    label: "Codex",
    mode: "coding",
    prompt: "继续以 Codex 协作方式推进当前项目，并给出下一步实现建议。",
  },
  {
    id: "projects",
    icon: FolderKanban,
    label: "项目",
    mode: "writing",
    prompt: "请把当前项目拆成可执行的里程碑和任务清单。",
  },
  {
    id: "discover",
    icon: Compass,
    label: "探索",
    mode: "chat",
    prompt: "请从产品、架构和交互三个层面给我探索这个项目的新方向。",
  },
];

export const starterPrompts: StarterPrompt[] = [
  {
    id: "knowledge",
    label: "公司知识库",
    mode: "writing",
    prompt: "请基于当前项目，设计一个适合内部问答的公司知识库方案。",
  },
  {
    id: "architecture",
    label: "架构建议",
    mode: "coding",
    prompt: "请基于当前技术栈，给我一套适合大项目演进的目录架构方案。",
  },
  {
    id: "roadmap",
    label: "研发路线图",
    mode: "writing",
    prompt: "请给我一个从 MVP 到生产环境的研发路线图和阶段目标。",
  },
];

export const recentConversationSeeds: ConversationPreview[] = [
  {
    id: "seed-langgraph",
    mode: "coding",
    title: "LangGraph TS 装饰器支持",
    meta: "结构扩展",
    prompt: "请分析 LangGraph TS 装饰器支持的实现思路和落地方式。",
  },
  {
    id: "seed-react-md",
    mode: "coding",
    title: "react-markdown 表格支持",
    meta: "前端渲染",
    prompt: "请帮我梳理 react-markdown 表格渲染的兼容方案。",
  },
  {
    id: "seed-node-agent",
    mode: "coding",
    title: "Node.js LangChain Agent 设计",
    meta: "后端编排",
    prompt: "请为 Node.js LangChain Agent 设计一个可扩展的服务端分层方案。",
  },
  {
    id: "seed-virtual-list",
    mode: "coding",
    title: "React 虚拟列表方案",
    meta: "性能优化",
    prompt: "请比较适合聊天页面的 React 虚拟列表方案和接入方式。",
  },
  {
    id: "seed-upload",
    mode: "coding",
    title: "Upload 组件 customRequest",
    meta: "交互细节",
    prompt: "请分析 Upload 组件 customRequest 的实现边界和常见坑位。",
  },
];
