[简体中文](README.md) | English

# Claude History Manager

> A local web console for browsing, searching, and managing your Claude Code conversation history

## Features

### Core

- 📁 **Project Browser**: Browse all projects that use Claude Code
- 💬 **Session History**: View all session records per project, with message count badges
- 📝 **Conversation View**: Chat-like interface for reading full conversation history
- 🎨 **Markdown Rendering**: Full Markdown support with syntax highlighting
- 🔧 **Tool Calls**: Collapsible view of system commands and tool invocations
- 🔍 **Global Search**: Full-text search across all projects with search history
- 🗑️ **Session Delete**: Remove unwanted old sessions
- 📥 **Export Markdown**: Download sessions as .md files
- 🌙 **Dark/Light Theme**: One-click theme toggle with automatic preference saving

### Analytics

- 📊 **Activity Stats**: Visual overview of Claude usage activity
- 📈 **Trend Chart**: Monthly session trend bar chart
- 🥧 **Project Distribution**: Pie chart showing usage share by project
- 📅 **Contribution Graph**: GitHub-style calendar heatmap
- 🕐 **Time Distribution**: 24-hour and day-of-week activity breakdown
- 📉 **Average Messages**: Average message count per session
- 📋 **Recent Sessions**: Quick access to recently modified sessions

## Tech Stack

### Backend

- Node.js + Express 5.x
- CORS support
- Local filesystem access with async I/O
- In-memory caching (15s TTL)

### Frontend

- Vue 3 + TypeScript (Composition API)
- Vite 7 (build tool)
- Element Plus (UI components)
- Marked + Highlight.js (Markdown and code highlighting)
- Inter + JetBrains Mono (fonts)

### Dev Tools

- concurrently (parallel script runner)
- vue-tsc (TypeScript type checking)
- ESLint + Prettier (code quality)

## Quick Start

### One-click (recommended)

```bash
# macOS / Linux
./start.sh

# Or with npm
npm run start
```

Open http://localhost:5175/ in your browser.

### Manual Start

```bash
# 1. Install dependencies
npm run install:all

# 2. Start backend server (port 3333)
npm run start:server

# 3. Start frontend dev server (port 5175)
npm run start:client
```

### Commands

```bash
npm run start           # Install deps and start
npm run start:dev       # Start both without reinstalling
npm run start:server    # Backend only
npm run start:client    # Frontend only
npm run install:all     # Install all dependencies
npm run install:server  # Backend dependencies only
npm run install:client  # Frontend dependencies only
npm run build:client    # Build frontend for production
npm run lint            # ESLint check
npm run format          # Prettier formatting
npm run type-check      # TypeScript type check
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/sessions?path=<path>` | List sessions for a project (includes `messageCount`) |
| GET | `/api/session-detail?filePath=<path>` | Get parsed conversation (use `?format=md` to export) |
| DELETE | `/api/sessions?filePath=<path>` | Delete a session |
| GET | `/api/search?q=<keyword>` | Full-text search across all conversations |
| GET | `/api/stats` | Statistics: projects, sessions, trends, distributions |
| GET | `/api/security/scan` | Scan for sensitive information |

The `/api/stats` response includes: `totalProjects`, `totalSessions`, `projectStats`, `contributionGraph`, `recentSessions`, `monthlyTrends`, `hourlyDistribution`, `dayOfWeekDistribution`, `avgMessageCount`.

## Project Structure

```
claude-history-manager/
├── server/                        # Backend
│   ├── index.js                   # Main server (6 API endpoints)
│   ├── utils.js                   # Shared utilities (file I/O, path matching, JSONL parsing)
│   ├── cache.js                   # In-memory TTL cache
│   ├── test.js                    # API integration tests
│   ├── .eslintrc.json
│   └── package.json
├── client/                        # Frontend
│   ├── src/
│   │   ├── main.ts                # Entry point
│   │   ├── App.vue                # Main app (single-file component)
│   │   ├── assets/base.css        # Theme variables (dark/light)
│   │   ├── composables/useApi.ts  # API call wrapper
│   │   └── components/
│   │       ├── ActivityStats.vue        # Activity stat cards
│   │       ├── ContributionGraph.vue    # GitHub-style heatmap
│   │       ├── MarkdownRenderer.vue     # Markdown + code highlighting
│   │       ├── ProjectPieChart.vue      # Project distribution pie chart
│   │       ├── RecentSessions.vue       # Recent sessions list
│   │       ├── StatsCharts.vue          # Monthly/hourly/weekday charts
│   │       └── TrendChart.vue           # Trend line chart
│   ├── .eslintrc.json
│   └── vite.config.ts
├── .gitignore
├── .prettierrc
├── .prettierignore
├── package.json
├── start.sh                       # One-click startup
├── CLAUDE.md
├── README.md                      # Chinese documentation
└── README.en.md                   # English documentation
```

## Node.js Requirements

Node.js **^20.19.0 || >=22.12.0**
