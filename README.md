# FluxDev - 智能Web开发平台

## 在线演示地址

[FluxDev在线演示](https://flux-dev-omega.vercel.app/) (需要科学上网环境)

## 简介

FluxDev是一个模仿Trae、Cursor等主流AI编程工具的在线简易AI编程编辑器，主要面向Web开发，旨在为用户提供便捷，智能的Web开发体验。

## 技术栈

- **框架**: Next.js (App Router), React
- **身份认证**: Clerk(GitHub)
- **类型安全**: TypeScript, Zod
- **状态管理**: Zustand
- **后端服务**: Convex
- **编辑器内核**: CodeMirror
- **AI 与自动化**: Vercel AI SDK, Inngest (异步任务调度与 AI Agent Kit)
- **沙盒运行环境**: WebContainer API
- **样式方案**: Tailwind CSS + shadcn/ui
- **其他工具**: XTerm.js (终端模拟), Octokit (GitHub 集成)

## 核心功能

- **项目初始化**：支持从零新建项目或直接从 GitHub 导入现有仓库。
- **项目管理**：支持在线重命名项目及一键回导（导出）至 GitHub 仓库。
- **文件管理**：集成了文件/文件夹的增删改查逻辑，支持多级目录递归。
- **AI 智能对话系统**：
  - 支持多会话切换与历史记录持久化。
  - AI 能够理解全路径项目上下文，支持一键生成完整的 Web Demo 项目。
  - 文件管理器实时感知 AI 生成的文件变化，支持即时预览。
- **定制代码编辑器**：
  - **AI 代码补全**：支持 Tab 键接收智能补全建议。
  - **划词交互工具栏**：支持代码快速编辑和一键添加至对话上下文。
  - **自动保存**：每隔 1.5s 自动保存一次。
- **现代化预览沙盒**：
  - 集成 **WebContainer**，支持在浏览器内进行项目网页预览。
  - 支持自定义安装命令（Install Command）与启动命令（Dev Command）。
  - 内置终端实时显示启动日志与运行状态。

## 项目结构

```
convex/
├── schema.ts              # 后端数据库模式定义
├── projects.ts            # 项目相关操作
├── files.ts               # 文件相关操作
├── conversations.ts       # 对话相关操作
└── system.ts              # 系统内部特权API，供Inngest后台任务调用

src/
├── app/                   # Next.js App Router
│   ├── api/               # API 路由
│   └── projects/          # 项目页面
├── components/            # 全局组件
│   ├── ui/                # shadcn/ui 组件
│   └── ai-elements/       # AI 对话相关的 UI 组件 (Vercel AI SDK提供)
├── feature/
│   ├── auth/              # 认证功能
│   ├── conversations/     # AI 交互
│   ├── editor/            # 编辑器
│   │   └── extensions/    # 编辑器的定制扩展 (AI 补全、划词工具栏、AI 快速编辑)
│   ├── preview/           # 网页预览
│   └── projects/          # 项目管理
├── inngest/               # Inngest 客户端初始化文件
└── lib/                   # 工具目录
```

## 开发指南

### 1. 安装依赖

```bash
npm install
```

### 2. 环境变量配置

在项目根目录创建 `.env.local` 文件并填写以下配置：

```env
# Convex 数据库配置
CONVEX_DEPLOYMENT="your-dev"
NEXT_PUBLIC_CONVEX_URL="your-url"
FLUXDEV_CONVEX_INTERNAL_KEY="your-internal-key" # 用于 Inngest 后台任务的内部鉴权

# Clerk 身份认证
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-publishable-key"
CLERK_SECRET_KEY="your-secret-key"
CLERK_JWT_ISSUER_DOMAIN="your-domain"

# Vercel AI SDK (代码补全与快速编辑)
GOOGLE_GENERATIVE_AI_API_KEY="your-api-key"
DEEPSEEK_API_KEY="your-api-key"
SUGGEST_QUICK_AI_MODEL="your-model"

# AI Agent 配置
AGENT_TITLE_GENERATE_MODEL="your-model"
AGENT_CODING_MODEL="your-model"
AGENT_BASE_URL="your-base-url"
AGENT_API_KEY="your-api-key"

# Jina Reader (网页爬取代理)
JINA_API_KEY="your-api-key"
```

### 3. 启动开发服务

```bash
# 启动 Convex 开发服务器 (处理数据持久化)
npx convex dev

# 启动 Inngest 开发服务器 (处理异步任务流)
npx --ignore-scripts=false inngest-cli@latest dev

# 启动 Next.js 主程序
npm run dev
```

### 4. 生产构建

```bash
npm run build
npm run start
```
