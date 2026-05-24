[English](README.en.md) | 简体中文

# Claude History Manager

> 本地私有化的 Claude Code 对话历史管理器 — 浏览、搜索、导出你的 Claude Code 本地提问记录

## 功能特性

### 核心功能

- 📁 **项目管理**: 浏览所有使用 Claude Code 的项目
- 💬 **会话历史**: 查看每个项目的所有会话记录，支持消息数量角标
- 📝 **对话详情**: 类似聊天界面的对话流展示
- 🎨 **Markdown 渲染**: 完整支持 Markdown 格式，包括代码高亮
- 🔧 **工具调用**: 可折叠查看 Claude 在后台执行的系统命令和工具调用
- 🔍 **全局搜索**: 跨所有项目全文搜索对话内容，支持搜索历史
- 🗑️ **会话删除**: 右键删除不需要的旧会话
- 📥 **导出 Markdown**: 将会话导出为 .md 文件下载
- 🌙 **明暗主题**: 深色/浅色主题一键切换，自动记忆

### 统计分析

- 📊 **活动统计**: 可视化展示 Claude 使用活跃度
- 📈 **趋势图表**: 月度会话趋势柱状图
- 🥧 **项目分布**: 饼图展示各项目使用占比
- 📅 **贡献图**: GitHub 风格日历热力图
- 🕐 **时段分析**: 24 小时时段分布 + 星期分布
- 📉 **平均消息**: 平均每次会话消息数统计
- 📋 **最近会话**: 快速查看最近的对话记录

## 技术栈

### 后端

- Node.js + Express 5.x
- CORS 支持
- 本地文件系统读取（异步 I/O）
- 内存缓存（15s TTL）

### 前端

- Vue 3 + TypeScript（Composition API）
- Vite 7（构建工具）
- Element Plus（UI 组件库）
- Marked + Highlight.js（Markdown 渲染和代码高亮）
- Inter + JetBrains Mono（字体）

### 开发工具

- concurrently（并行运行脚本）
- vue-tsc（TypeScript 类型检查）
- ESLint + Prettier（代码规范）

## 快速开始

### 一键启动（推荐）

```bash
# macOS / Linux
./start.sh

# 或使用 npm
npm run start
```

服务启动后，打开浏览器访问: http://localhost:5175/

### 手动启动

```bash
# 1. 安装依赖
npm run install:all

# 2. 启动后端服务器 (端口 3333)
npm run start:server

# 3. 启动前端开发服务器 (端口 5175)
npm run start:client
```

### 可用命令

```bash
npm run start           # 安装依赖并一键启动
npm run start:dev       # 启动前后端（不安装依赖）
npm run start:server    # 仅启动后端
npm run start:client    # 仅启动前端
npm run install:all     # 安装前后端依赖
npm run install:server  # 仅安装后端依赖
npm run install:client  # 仅安装前端依赖
npm run build:client    # 构建前端项目
npm run lint            # ESLint 代码检查
npm run format          # Prettier 代码格式化
npm run type-check      # TypeScript 类型检查
```

## API 接口

### 获取项目列表

```
GET /api/projects
```

### 获取会话列表

```
GET /api/sessions?path=<项目路径>
```

返回包含 `messageCount` 字段的会话列表。

### 获取会话详情

```
GET /api/session-detail?filePath=<会话文件路径>
```

支持 `?format=md` 参数导出 Markdown 文件。

### 删除会话

```
DELETE /api/sessions?filePath=<会话文件路径>
```

### 全局搜索

```
GET /api/search?q=<关键词>
```

### 获取统计信息

```
GET /api/stats
```

返回数据包含：`totalProjects`、`totalSessions`、`projectStats`、`contributionGraph`、`recentSessions`、`monthlyTrends`、`hourlyDistribution`、`dayOfWeekDistribution`、`avgMessageCount`。

### 安全扫描

```
GET /api/security/scan
```

## 项目结构

```
claude-history-manager/
├── server/                        # 后端服务
│   ├── index.js                   # 主服务文件（6 个 API 端点）
│   ├── utils.js                   # 共享工具函数（文件读取、路径匹配、JSONL 解析）
│   ├── cache.js                   # 内存 TTL 缓存
│   ├── test.js                    # API 集成测试
│   ├── .eslintrc.json             # ESLint 配置（Node.js）
│   ├── package.json
│   └── node_modules/
├── client/                        # 前端应用
│   ├── src/
│   │   ├── main.ts                # 入口文件
│   │   ├── App.vue                # 主应用组件（单文件）
│   │   ├── env.d.ts
│   │   ├── assets/
│   │   │   └── base.css           # 主题变量（深色/浅色）
│   │   ├── composables/
│   │   │   └── useApi.ts          # API 调用封装
│   │   └── components/
│   │       ├── ActivityStats.vue          # 活动统计卡片
│   │       ├── ContributionGraph.vue      # GitHub 风格贡献热力图
│   │       ├── MarkdownRenderer.vue       # Markdown 渲染 + 代码高亮
│   │       ├── ProjectPieChart.vue        # 项目分布饼图
│   │       ├── RecentSessions.vue         # 最近会话列表
│   │       ├── StatsCharts.vue            # 月度趋势/时段/星期统计图表
│   │       └── TrendChart.vue             # 对话趋势折线图
│   ├── .eslintrc.json             # ESLint 配置（Vue 3 + TypeScript）
│   ├── package.json
│   └── vite.config.ts
├── .gitignore                     # Git 忽略配置
├── .prettierrc                    # Prettier 格式化配置
├── .prettierignore
├── package.json                   # 根项目配置
├── start.sh                       # 一键启动脚本
├── CLAUDE.md                      # Claude Code 项目指南
└── README.md                      # 本文档
```

## Node.js 版本要求

项目要求 Node.js 版本为 **^20.19.0 || >=22.12.0**
