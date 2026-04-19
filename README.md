# agent-test

一个基于 `pnpm workspace` 的 AI 对话工作台示例项目，包含 Web 前端和 Server 后端两个应用。

## Overview
- 前端提供聊天工作台、会话列表、消息流式渲染和图片输入入口。
- 后端负责意图识别、技能路由、上下文压缩、模型调用和会话持久化。
- 会话数据存储在 PostgreSQL 中，接口通过 OpenAPI 导出并由前端生成客户端代码。

## Features
- 基于 SSE 的流式对话体验
- 会话创建、重命名、删除与历史消息加载
- Agent 意图识别、技能目录和执行 trace
- OpenAPI -> Orval 前端客户端生成链路
- 图片输入识别与图片角色判断占位流程

## Tech Stack
- Frontend: React 19, Vite 8, TanStack Router, TanStack Query, Tailwind CSS 4
- Backend: NestJS 11, Fastify, Prisma 7, PostgreSQL, Zod, LangChain, LangGraph
- Tooling: pnpm workspace, TypeScript, Orval

## Project Structure
```text
.
|-- apps/
|   |-- server/   # NestJS + Prisma + LangGraph
|   `-- web/      # React + Vite chat workspace
|-- .agents/      # repo skills for agent tooling
|-- .claude/      # Claude-related skills/config
|-- AGENTS.md     # shared project context for Codex and other tools
|-- CLAUDE.md     # Claude entry that reuses AGENTS.md
`-- package.json
```

## Getting Started

### Prerequisites
- `pnpm`
- PostgreSQL
- OpenAI-compatible API key or local compatible gateway

### Install
```bash
pnpm install
```

### Configure Environment
在 `apps/server` 下准备环境变量：

- `.env`
- `.env.agent`

可参考：

- `apps/server/.env.example`
- `apps/server/.env.agent.example`

### Run in Development
```bash
pnpm dev
```

默认情况下：

- Web: `http://localhost:5173`
- API: `http://localhost:3001/api`

## Available Scripts
- `pnpm dev`: 同时启动前后端
- `pnpm dev:server`: 启动服务端开发环境
- `pnpm dev:web`: 启动前端开发环境
- `pnpm api:spec`: 导出 OpenAPI JSON
- `pnpm api:generate`: 重新生成前端 API 客户端
- `pnpm build`: 构建全部应用
- `pnpm lint`: 执行工作区检查
- `pnpm typecheck`: 执行工作区类型检查

## API Generation
后端 OpenAPI 导出文件位于：

- `apps/web/openapi/agent-api.json`

前端生成客户端位于：

- `apps/web/src/services/api/generated`

当后端接口、DTO 或 OpenAPI 文档变更时，建议执行：

```bash
pnpm api:generate
```

## Current Status
- 文本对话主链路已接通。
- 图片输入目前只完成识别和路由占位，尚未接入真实图片模型。
- 当前仓库未配置自动化测试，主要依赖类型检查和构建验证。

## Documentation
- 项目上下文：`AGENTS.md`
- Claude 入口：`CLAUDE.md`
