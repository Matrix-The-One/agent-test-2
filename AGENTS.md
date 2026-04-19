# AGENTS

## 项目概览
- 这是一个 `pnpm workspace` 单仓项目，当前包含 `apps/server` 和 `apps/web` 两个应用。
- 产品形态是一个 AI 对话工作台：前端负责聊天界面、会话管理、流式消息渲染；后端负责意图识别、技能路由、上下文压缩、模型调用和会话持久化。
- 主交互链路是：Web Chat -> `POST /api/agent/stream` -> 服务端 LangGraph 工作流 -> SSE 流式返回 -> 前端渲染并保存消息。
- 会话数据持久化到 PostgreSQL，核心实体是 `User`、`Conversation`、`Message`。
- 当前服务端已经支持图片输入的意图识别与图片角色判断，但尚未接入真正的图片生成或改图模型；图片请求目前返回占位说明。

## 技术栈
- 包管理与工作区：`pnpm`、workspace、TypeScript。
- 服务端：NestJS 11、Fastify、Prisma 7、PostgreSQL、Zod、OpenAPI、LangChain、LangGraph。
- 前端：React 19、Vite 8、TanStack Router、TanStack Query、Vercel AI SDK、Tailwind CSS 4。
- UI 基础组件：`apps/web/components.json` 显示为 shadcn 风格配置，组件源码位于 `apps/web/src/components/ui`。
- 当前仓库未发现测试目录或测试用例，现阶段主要依赖 `lint`、`typecheck`、`build` 做验证。

## 工作区结构

### 根目录
- `package.json`：工作区统一脚本入口。
- `pnpm-workspace.yaml`：声明 `apps/*` 为 workspace 包。
- `tsconfig.base.json`：前后端共用的 TypeScript 基础配置。

### 服务端
- `apps/server/src/main.ts`：Nest 应用启动入口。
- `apps/server/src/appFactory.ts`：装配全局前缀、CORS、异常过滤器、响应拦截器。
- `apps/server/src/appModule.ts`：顶层模块注册。
- `apps/server/src/Config/env.ts`：环境变量加载与校验。
- `apps/server/prisma/schema.prisma`：数据库模型定义。
- `apps/server/src/Modules/Agent`：AI 编排核心，包含意图识别、图片角色识别、上下文预算、模型工厂、LangGraph 节点和流式输出。
- `apps/server/src/Modules/Conversations`：会话读写、标题派生、上下文摘要、消息持久化。
- `apps/server/src/Modules/SkillCatalog`：技能目录与公开技能信息。
- `apps/server/src/Common`：Prisma、OpenAPI、过滤器、拦截器、Pipe 等基础设施。

### 前端
- `apps/web/src/main.tsx`：React 挂载入口。
- `apps/web/src/App.tsx`：顶层 Provider 装配。
- `apps/web/src/routes/router.tsx`：当前只有聊天工作台相关路由。
- `apps/web/src/hooks/useAgentChatWorkspace.ts`：聊天工作台核心状态与请求编排。
- `apps/web/src/pages/ChatWorkspace`：页面与页面级组件。
- `apps/web/src/services/chat/chatApi.ts`：对生成 API 客户端的业务封装。
- `apps/web/src/services/api/generated`：Orval 生成代码。
- `apps/web/openapi/agent-api.json`：服务端导出的 OpenAPI 产物。

### AI 相关目录
- `.agents/skills/*/SKILL.md`：仓库内技能。
- `.claude/skills/*/SKILL.md`：Claude 相关技能目录，当前与 `.agents/skills` 下的技能集合一致。

## AI 工具文件放置约定
- 根目录 `AGENTS.md` 是 Codex 的项目说明主入口。
- 根目录 `CLAUDE.md` 是 Claude Code 的项目记忆入口；当前内容通过 `@AGENTS.md` 复用同一份项目上下文。
- `.agents/` 目录用于放技能等 agent 资源，不作为 Codex 项目说明文件的默认读取位置。
- `.claude/` 目录适合放 Claude 的工具配置和技能，不建议把唯一的项目说明只放在 `.claude/` 里。
- 如果后续增加其他 AI 工具说明文件，优先让它们引用根目录 `AGENTS.md`，避免多份项目文档漂移。

## 关键命令
- `pnpm dev`：同时启动前后端。
- `pnpm dev:server`：启动服务端开发环境。
- `pnpm dev:web`：启动前端开发环境。
- `pnpm api:spec`：导出 OpenAPI JSON。
- `pnpm api:generate`：导出 OpenAPI 并重新生成前端 API 客户端。
- `pnpm build`：构建所有 workspace 包。
- `pnpm lint`：执行工作区检查，当前本质是 TypeScript 无输出检查。
- `pnpm typecheck`：执行工作区类型检查。

## 运行时与环境变量
- 服务端会先加载 `apps/server/.env.agent`，再加载 `apps/server/.env`。
- `apps/server/.env` 用于项目运行参数，如 `PORT`、`APP_ORIGIN`、`DATABASE_URL`、`REQUEST_BODY_LIMIT_MB`。
- `apps/server/.env.agent` 用于模型供应商或代理参数，如 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。
- Web 开发服务器默认端口是 `5173`，并通过 Vite 代理把 `/api` 转发到 `http://localhost:3001`。
- Server 默认端口是 `3001`，全局 API 前缀是 `/api`。
- 默认模型环境变量是 `OPENAI_MODEL=gpt-5.4-mini`。

## 数据模型与接口
- Prisma 生成客户端输出到 `apps/server/src/generated/prisma`。
- `User` 持有用户信息。
- `Conversation` 记录会话标题、模式和更新时间。
- `Message` 记录角色、文本、图片、metadata 和 trace。
- 健康检查接口：`GET /api/health`
- 用户接口：`POST /api/users/ensure`、`GET /api/users/:userId`
- 会话接口：`GET /api/conversations`、`POST /api/conversations`、`PATCH /api/conversations/:conversationId`、`GET /api/conversations/:conversationId/messages`、`DELETE /api/conversations/:conversationId`
- Agent 流式接口：`POST /api/agent/stream`
- 技能目录接口：`GET /api/agent/skills`

## 生成链路
- 后端 OpenAPI 导出脚本在 `apps/server/src/openApiExport.ts`。
- `pnpm api:spec` 会生成 `apps/web/openapi/agent-api.json`。
- `pnpm api:generate` 会刷新 `apps/web/src/services/api/generated/**/*`。
- 改动后端 DTO、控制器签名或 OpenAPI 文档后，应优先重新生成前端 API 客户端，而不是手改生成文件。

## 代码约定
- 包管理器统一使用 `pnpm`。
- 服务端目录结构遵循 `Modules/<Feature>/{Application,Domain,Infrastructure,Presentation}`。
- 服务端 TypeScript 运行在 ESM / `NodeNext` 模式下，源码 import 中保留 `.js` 后缀是正常约定。
- 前端启用了 `@/* -> ./src/*` 路径别名，新增前端代码优先使用别名导入。
- 前端页面和业务组件使用 `PascalCase` 导出名。
- `apps/web/src/components/ui` 目录当前文件名采用 `kebab-case`。
- 聊天工作台相关状态和请求逻辑优先放在 `useAgentChatWorkspace.ts`，不要把同类状态拆散到多个页面组件中。

## 建议优先阅读的文件
- `package.json`
- `apps/server/package.json`
- `apps/web/package.json`
- `apps/server/src/Config/env.ts`
- `apps/server/src/Modules/Agent/Application/Services/agentService.ts`
- `apps/server/src/Modules/Conversations/Application/Services/conversationService.ts`
- `apps/server/prisma/schema.prisma`
- `apps/web/src/hooks/useAgentChatWorkspace.ts`
- `apps/web/src/pages/ChatWorkspace/index.tsx`
- `apps/web/src/services/chat/chatApi.ts`

## 当前已知限制
- 图片链路只完成了识别和路由占位，未接入真实图片模型。
- 仓库当前未配置自动化测试；改动后主要依赖类型检查和构建验证。
- 前端存在一批近期新增的 UI 基础组件文件，修改 UI 目录时需要先确认哪些文件是当前实际使用的。
