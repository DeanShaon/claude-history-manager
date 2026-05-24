<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox, ElDialog, ElInput, ElBadge } from "element-plus";
import MarkdownRenderer from "./components/MarkdownRenderer.vue";
import ContributionGraph from "./components/ContributionGraph.vue";
import ProjectPieChart from "./components/ProjectPieChart.vue";
import RecentSessions from "./components/RecentSessions.vue";
import TrendChart from "./components/TrendChart.vue";
import ActivityStats from "./components/ActivityStats.vue";
import StatsCharts from "./components/StatsCharts.vue";

// API 基础 URL
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3333/api";

// 复制到剪贴板
const copyToClipboard = async (text: string, label?: string) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success({
      message: label ? `${label} 已复制` : "已复制",
      duration: 1500,
      plain: true,
    });
  } catch (err) {
    ElMessage.error("复制失败");
  }
};

// 全局搜索相关
const searchDialogVisible = ref(false);
const searchQuery = ref("");
const searchResults = ref<any[]>([]);
const searching = ref(false);
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const selectedSearchResult = ref<any>(null);
const previewLoading = ref(false);
const previewMessages = ref<Message[]>([]);
const shortcutsHelpVisible = ref(false);

// 主题切换
const theme = ref(localStorage.getItem("claude-theme") || "dark");
const applyTheme = () => document.documentElement.setAttribute("data-theme", theme.value);
const toggleTheme = () => {
  theme.value = theme.value === "dark" ? "light" : "dark";
  localStorage.setItem("claude-theme", theme.value);
  applyTheme();
};
onMounted(() => applyTheme());

// 搜索历史
const searchHistory = ref<string[]>(JSON.parse(localStorage.getItem("claude-search-history") || "[]"));
const showSearchHistory = ref(false);
const addSearchHistory = (q: string) => {
  const history = searchHistory.value.filter(h => h !== q);
  history.unshift(q);
  searchHistory.value = history.slice(0, 10);
  localStorage.setItem("claude-search-history", JSON.stringify(searchHistory.value));
};
const clearSearchHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem("claude-search-history");
};

// 快捷键列表
const shortcuts = [
  { key: "⌘ K", description: "全局搜索", action: "唤起搜索框" },
  { key: "Esc", description: "关闭弹窗", action: "关闭当前打开的对话框" },
  {
    key: "1/2/3",
    description: "切换视图",
    action: "1=仪表盘 2=项目浏览 3=全局搜索",
  },
  { key: "↑/↓", description: "导航", action: "在列表中上下移动" },
  { key: "Enter", description: "确认", action: "选中当前项" },
];

// 执行搜索
const performSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  searching.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/search?q=${encodeURIComponent(searchQuery.value)}`,
    );
    const data = await response.json();
    if (data.success) {
      searchResults.value = data.results;
      addSearchHistory(searchQuery.value);
    }
  } catch (error) {
    errorSearch.value = "搜索失败，请确认后端服务是否已启动";
    ElMessage.error("搜索失败");
  } finally {
    searching.value = false;
  }
};

// 防抖搜索
watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    performSearch();
  }, 300);
});

// 选择搜索结果
const selectSearchResult = (result: any, jumpToView = false) => {
  selectedSearchResult.value = result;

  if (jumpToView) {
    // 跳转到项目和会话详情视图
    const project = projects.value.find((p) => p.path === result.projectPath);
    if (project) {
      currentView.value = "projects";
      handleSelectProject(project);
      // 延迟获取会话列表后再选中会话
      setTimeout(() => {
        const session = sessions.value.find((s) => s.id === result.sessionId);
        if (session) {
          handleSelectSession(session);
        }
      }, 100);
    }
    searchDialogVisible.value = false;
  } else {
    // 在预览窗格中显示
    loadPreviewMessages(result);
  }
};

// 加载预览消息
const loadPreviewMessages = async (result: any) => {
  previewLoading.value = true;
  previewMessages.value = [];
  try {
    const response = await fetch(
      `${API_BASE}/session-detail?filePath=${encodeURIComponent(result.sessionPath)}`,
    );
    const data = await response.json();
    if (data.success) {
      previewMessages.value = data.messages;
    }
  } catch (error) {
    errorPreview.value = "加载预览失败，请确认后端服务是否已启动";
    ElMessage.error("加载预览失败");
  } finally {
    previewLoading.value = false;
  }
};

// 快捷键监听
const handleKeydown = (e: KeyboardEvent) => {
  // Cmd/Ctrl + K 唤起搜索
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    searchDialogVisible.value = true;
    searchQuery.value = "";
    searchResults.value = [];
    setTimeout(() => {
      const input = document.querySelector(
        ".search-input input",
      ) as HTMLInputElement;
      input?.focus();
    }, 100);
  }
  // ? 唤起快捷键帮助
  if (e.key === "?" && !searchDialogVisible.value) {
    e.preventDefault();
    shortcutsHelpVisible.value = true;
  }
  // 数字键切换视图
  if (["1", "2", "3"].includes(e.key) && !e.metaKey && !e.ctrlKey) {
    const viewMap: Record<string, ViewType> = {
      "1": "dashboard",
      "2": "projects",
      "3": "search",
    };
    const newView = viewMap[e.key];
    if (newView) {
      currentView.value = newView;
    }
  }
  // ESC 关闭弹窗
  if (e.key === "Escape") {
    if (searchDialogVisible.value) {
      searchDialogVisible.value = false;
    }
    if (shortcutsHelpVisible.value) {
      shortcutsHelpVisible.value = false;
    }
  }
};

// 数据类型定义
interface Project {
  path: string;
  name: string;
  lastSessionId: string | null;
}

interface Session {
  id: string;
  filename: string;
  path: string;
  modifiedAt: Date;
}

interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCall[];
}

// 响应式状态
const projects = ref<Project[]>([]);
const sessions = ref<Session[]>([]);
const messages = ref<Message[]>([]);
const selectedProject = ref<Project | null>(null);
const selectedSession = ref<Session | null>(null);
const loadingProjects = ref(false);
const loadingSessions = ref(false);
const loadingMessages = ref(false);
const sessionTitles = ref<Record<string, string>>({});

// 错误状态
const errorProjects = ref("");
const errorSessions = ref("");
const errorMessages = ref("");
const errorStats = ref("");
const errorSearch = ref("");
const errorPreview = ref("");

// 视图类型
type ViewType = "dashboard" | "projects" | "search";
const currentView = ref<ViewType>("projects");

// 导航菜单项
const navItems = [
  { key: "dashboard" as ViewType, label: "仪表盘" },
  { key: "projects" as ViewType, label: "项目浏览" },
  { key: "search" as ViewType, label: "全局搜索" },
];

// 统计数据
const stats = ref<any>(null);
const loadingStats = ref(false);

const fetchStats = async () => {
  loadingStats.value = true;
  try {
    const response = await fetch(`${API_BASE}/stats`);
    const data = await response.json();
    if (data.success) {
      stats.value = data.stats;
    }
  } catch (error) {
    errorStats.value = "获取统计数据失败，请确认后端服务是否已启动";
    ElMessage.error("获取统计数据失败");
  } finally {
    loadingStats.value = false;
  }
};

// 获取项目列表
const fetchProjects = async () => {
  loadingProjects.value = true;
  try {
    const response = await fetch(`${API_BASE}/projects`);
    const data = await response.json();
    if (data.success) {
      projects.value = data.projects;
    }
  } catch (error) {
    errorProjects.value = "获取项目列表失败，请确认后端服务是否已启动";
    ElMessage.error("获取项目列表失败");
  } finally {
    loadingProjects.value = false;
  }
};

// 获取会话列表
const fetchSessions = async (projectPath: string) => {
  loadingSessions.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/sessions?path=${encodeURIComponent(projectPath)}`,
    );
    const data = await response.json();
    if (data.success) {
      sessions.value = data.sessions;
    }
  } catch (error) {
    errorSessions.value = "获取会话列表失败，请确认后端服务是否已启动";
    ElMessage.error("获取会话列表失败");
  } finally {
    loadingSessions.value = false;
  }
};

// 获取会话详情
const fetchSessionDetail = async (filePath: string) => {
  loadingMessages.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/session-detail?filePath=${encodeURIComponent(filePath)}`,
    );
    const data = await response.json();
    if (data.success) {
      messages.value = data.messages;
      // 自动生成会话标题
      if (
        selectedSession.value &&
        !sessionTitles.value[selectedSession.value.id]
      ) {
        sessionTitles.value[selectedSession.value.id] = generateSessionTitle(
          data.messages,
        );
      }
    }
  } catch (error) {
    errorMessages.value = "获取会话详情失败，请确认后端服务是否已启动";
    ElMessage.error("获取会话详情失败");
  } finally {
    loadingMessages.value = false;
  }
};

// 删除会话
const deleteSession = async (session: Session) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除此会话吗？此操作不可恢复。`,
      "确认删除",
      { confirmButtonText: "删除", cancelButtonText: "取消", type: "warning", confirmButtonClass: "el-button--danger" }
    );
    const res = await fetch(`${API_BASE}/sessions?filePath=${encodeURIComponent(session.path)}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      ElMessage.success("已删除");
      sessions.value = sessions.value.filter(s => s.id !== session.id);
      if (selectedSession.value?.id === session.id) {
        selectedSession.value = null;
        messages.value = [];
      }
      if (selectedProject.value) fetchSessions(selectedProject.value.path);
    }
  } catch (error: any) {
    if (error !== "cancel" && error !== "close") ElMessage.error("删除失败");
  }
};

// 导出会话为 Markdown
const exportSession = (session: Session) => {
  const url = `${API_BASE}/session-detail?filePath=${encodeURIComponent(session.path)}&format=md`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `session-${session.id.slice(0, 8)}.md`;
  a.click();
  ElMessage.success("开始下载");
};

// 智能生成会话标题
const generateSessionTitle = (messages: Message[]): string => {
  if (!messages || messages.length === 0) {
    return "新对话";
  }

  // 获取前几条用户消息
  const userMessages = messages.filter((m) => m.role === "user").slice(0, 2);
  const firstUserMessage = userMessages[0]?.content || "";

  // 提取关键信息生成标题
  let title = "";

  // 尝试识别常见任务类型
  const taskPatterns = [
    { pattern: /创建|新建|添加|generate|create/i, prefix: "创建" },
    { pattern: /修复|解决|fix|solve|debug/i, prefix: "修复" },
    { pattern: /优化|改进|improve|optimize/i, prefix: "优化" },
    { pattern: /实现|完成|implement|complete/i, prefix: "实现" },
    { pattern: /删除|移除|delete|remove/i, prefix: "删除" },
    { pattern: /更新|修改|修改|update|modify|change/i, prefix: "更新" },
    { pattern: /搜索|查找|search|find/i, prefix: "搜索" },
    { pattern: /分析|了解|analyze|understand/i, prefix: "分析" },
  ];

  for (const { pattern, prefix } of taskPatterns) {
    if (pattern.test(firstUserMessage)) {
      title = prefix;
      break;
    }
  }

  // 提取关键词
  const cleanText = firstUserMessage
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
    .trim()
    .substring(0, 50);

  const keywords = cleanText.split(/\s+/).filter((w) => w.length > 1);

  // 组合标题
  if (!title) {
    title = keywords[0] || "对话";
  } else if (keywords.length > 0) {
    const keyword = keywords.find((k) => k.length <= 8) || keywords[0];
    title += " " + keyword;
  }

  // 限制长度
  if (title.length > 20) {
    title = title.substring(0, 20) + "...";
  }

  return title || "新对话";
};

// 获取会话标题
const getSessionTitle = (sessionId: string): string => {
  return sessionTitles.value[sessionId] || sessionId.slice(0, 8);
};

// 选择项目
const handleSelectProject = (project: Project) => {
  selectedProject.value = project;
  selectedSession.value = null;
  messages.value = [];
  fetchSessions(project.path);
};

// 选择会话
const handleSelectSession = (session: Session) => {
  selectedSession.value = session;
  fetchSessionDetail(session.path);
};

// 处理最近会话点击
const handleRecentSessionClick = (sessionData: any) => {
  // 切换到项目视图
  currentView.value = "projects";

  // 查找并选择项目
  const project = projects.value.find(
    (p) => p.path === sessionData.projectPath,
  );
  if (project) {
    handleSelectProject(project);

    // 延迟获取会话列表后再选中会话
    setTimeout(() => {
      const session = sessions.value.find(
        (s) => s.id === sessionData.sessionId,
      );
      if (session) {
        handleSelectSession(session);
      }
    }, 100);
  }
};

// 格式化时间
const formatDate = (date: Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 高亮搜索关键词
const highlightSearchTerm = (text: string, term: string) => {
  if (!term || !text) return text;
  const regex = new RegExp(
    `(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
};

// 组件挂载时获取项目列表
onMounted(() => {
  fetchProjects();
  fetchStats();
  // 添加键盘事件监听
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="app-container">
    <!-- 全局搜索弹窗 -->
    <ElDialog
      v-model="searchDialogVisible"
      title="全局搜索"
      width="600px"
      class="search-dialog"
      :show-close="true"
      @close="
        () => {
          searchQuery = '';
          searchResults = [];
        }
      "
    >
      <ElInput
        v-model="searchQuery"
        placeholder="搜索对话内容... (Cmd+K)"
        class="search-input"
        clearable
        aria-label="搜索对话内容"
      >
        <template #prefix>
          <span>🔍</span>
        </template>
      </ElInput>

      <div class="search-results">
        <div v-if="searching" class="search-loading">搜索中...</div>
        <div v-else-if="errorSearch" class="error-state" role="alert">
          <p>{{ errorSearch }}</p>
          <button class="retry-btn" @click="performSearch">重试</button>
        </div>
        <div
          v-else-if="searchResults.length === 0 && searchQuery"
          class="search-empty"
        >
          未找到匹配结果
        </div>
        <div v-else-if="!searchQuery" class="search-hint">
          <div v-if="searchHistory.length > 0" class="search-history">
            <div class="search-history-header">
              <span>最近搜索</span>
              <button class="search-history-clear" @click="clearSearchHistory">清除</button>
            </div>
            <div
              v-for="(h, i) in searchHistory"
              :key="i"
              class="search-history-item"
              @click="searchQuery = h; performSearch()"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              {{ h }}
            </div>
          </div>
          <p v-else>输入关键词开始搜索，支持跨所有项目的对话内容</p>
        </div>
        <div v-else class="search-list">
          <div
            v-for="(result, index) in searchResults"
            :key="index"
            class="search-result-item"
            @click="selectSearchResult(result)"
          >
            <div class="search-result-header">
              <span class="search-project">{{ result.projectName }}</span>
              <span class="search-session">{{
                result.sessionId.slice(0, 8)
              }}</span>
            </div>
            <div class="search-preview">{{ result.preview }}</div>
          </div>
        </div>
      </div>
    </ElDialog>

    <!-- 快捷键帮助弹窗 -->
    <ElDialog
      v-model="shortcutsHelpVisible"
      title="快捷键帮助"
      width="500px"
      class="shortcuts-dialog"
      :show-close="true"
    >
      <div class="shortcuts-list">
        <div
          v-for="(shortcut, index) in shortcuts"
          :key="index"
          class="shortcut-item"
        >
          <div class="shortcut-key">
            <kbd>{{ shortcut.key }}</kbd>
          </div>
          <div class="shortcut-info">
            <div class="shortcut-desc">{{ shortcut.description }}</div>
            <div class="shortcut-action">{{ shortcut.action }}</div>
          </div>
        </div>
      </div>
      <div class="shortcuts-footer">
        <p>按 <kbd>?</kbd> 或 <kbd>Esc</kbd> 关闭</p>
      </div>
    </ElDialog>

    <div class="app-layout">
      <!-- 左侧图标导航栏 -->
      <nav class="nav-bar" aria-label="主导航">
        <div class="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </div>
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-btn"
          :class="{ active: currentView === item.key }"
          :data-nav="item.key"
          :title="item.label"
          @click="currentView = item.key"
        >
          <svg
            v-if="item.key === 'dashboard'"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <svg
            v-else-if="item.key === 'projects'"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            />
          </svg>
          <svg
            v-else-if="item.key === 'search'"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <button class="nav-btn theme-toggle" :title="theme === 'dark' ? '切换浅色主题' : '切换深色主题'" @click="toggleTheme">
          <svg v-if="theme === 'dark'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        </button>
      </nav>

      <!-- 主内容区 -->
      <div class="main-content">
        <!-- 项目列表面板 -->
        <aside v-if="currentView === 'projects'" class="project-panel" aria-label="项目列表">
          <div class="panel-title">
            <span>项目列表</span>
            <span class="badge">{{ projects.length }}</span>
            <button class="icon-btn" title="刷新项目列表" @click="fetchProjects">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
          </div>
          <div v-if="loadingProjects" class="loading">加载中...</div>
          <div v-else-if="errorProjects" class="error-state" role="alert">
            <p>{{ errorProjects }}</p>
            <button class="retry-btn" @click="fetchProjects">重试</button>
          </div>
          <div v-else-if="projects.length === 0" class="empty-text">
            暂无项目
          </div>
          <div v-else class="panel-list">
            <div
              v-for="project in projects"
              :key="project.path"
              class="project-item"
              :class="{ active: selectedProject?.path === project.path }"
              :data-project="project.path"
              @click="handleSelectProject(project)"
            >
              <span class="project-name">{{ project.name }}</span>
              <svg
                v-if="selectedProject?.path === project.path"
                class="chevron"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>
        </aside>

        <!-- 会话列表面板 -->
        <aside v-if="currentView === 'projects'" class="conv-panel" aria-label="会话列表">
          <div class="panel-title">
            <span>会话列表</span>
            <span class="badge">{{ sessions.length }}</span>
            <button v-if="selectedProject" class="icon-btn" title="刷新会话列表" @click="fetchSessions(selectedProject.path)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
          </div>
          <div v-if="loadingSessions" class="loading">加载中...</div>
          <div v-else-if="errorSessions" class="error-state" role="alert">
            <p>{{ errorSessions }}</p>
            <button class="retry-btn" @click="selectedProject && fetchSessions(selectedProject.path)">重试</button>
          </div>
          <div v-else-if="!selectedProject" class="empty-text">
            请先选择项目
          </div>
          <div v-else-if="sessions.length === 0" class="empty-text">
            暂无会话
          </div>
          <div v-else class="panel-list">
            <div
              v-for="session in sessions"
              :key="session.id"
              class="conv-item"
              :class="{ active: selectedSession?.id === session.id }"
              :data-conv="session.id"
              @click="handleSelectSession(session)"
            >
              <div class="conv-title">
                <span class="conv-title-text">{{ getSessionTitle(session.id) }}</span>
                <ElBadge v-if="session.messageCount" :value="session.messageCount" class="conv-badge" />
              </div>
              <div class="conv-meta">
                <span class="conv-hash" :title="session.id">{{
                  session.id.slice(0, 8)
                }}</span>
                <span class="conv-time">{{
                  formatDate(session.modifiedAt)
                }}</span>
              </div>
              <div class="conv-actions" @click.stop>
                <button class="mini-btn" title="导出 Markdown" @click="exportSession(session)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button class="mini-btn mini-btn--danger" title="删除会话" @click="deleteSession(session)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              </div>
            </div>
          </div>
        </aside>

        <!-- 搜索列表面板 -->
        <aside v-if="currentView === 'search'" class="search-panel" aria-label="搜索结果">
          <div class="panel-title">全局搜索</div>
          <div class="search-view-content">
            <ElInput
              v-model="searchQuery"
              placeholder="搜索所有项目的对话内容..."
              size="large"
              class="search-view-input"
              clearable
              aria-label="搜索所有项目对话"
            >
              <template #prefix>
                <span>🔍</span>
              </template>
            </ElInput>
            <div class="search-results-list">
              <div v-if="searching" class="search-loading">搜索中...</div>
              <div v-else-if="errorSearch" class="error-state" role="alert">
                <p>{{ errorSearch }}</p>
                <button class="retry-btn" @click="performSearch">重试</button>
              </div>
              <div
                v-else-if="searchResults.length === 0 && searchQuery"
                class="search-empty"
              >
                未找到匹配结果
              </div>
              <div v-else-if="!searchQuery" class="search-hint">
                <div v-if="searchHistory.length > 0" class="search-history">
                  <div class="search-history-header">
                    <span>最近搜索</span>
                    <button class="search-history-clear" @click="clearSearchHistory">清除</button>
                  </div>
                  <div
                    v-for="(h, i) in searchHistory"
                    :key="i"
                    class="search-history-item"
                    @click="searchQuery = h; performSearch()"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
                    {{ h }}
                  </div>
                </div>
                <p v-else>输入关键词开始搜索，支持跨所有项目的对话内容</p>
              </div>
              <div v-else class="search-result-items">
                <div
                  v-for="(result, index) in searchResults"
                  :key="index"
                  class="search-result-item"
                  :class="{
                    selected:
                      selectedSearchResult?.sessionPath === result.sessionPath,
                  }"
                  @click="selectSearchResult(result, false)"
                  @dblclick="selectSearchResult(result, true)"
                >
                  <div class="search-result-header">
                    <span class="search-project">{{ result.projectName }}</span>
                    <span class="search-session-id" :title="result.sessionId">{{
                      result.sessionId.slice(0, 8)
                    }}</span>
                  </div>
                  <div
                    class="search-preview"
                    v-html="highlightSearchTerm(result.preview, searchQuery)"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- 右侧主内容区 -->
        <main class="main-pane" aria-label="内容区域">
          <!-- 仪表盘视图 -->
          <div v-if="currentView === 'dashboard'" class="dashboard-main">
            <div v-if="loadingStats" class="dashboard-loading">
              加载统计中...
            </div>
            <div v-else-if="errorStats" class="error-state" role="alert">
              <p>{{ errorStats }}</p>
              <button class="retry-btn" @click="fetchStats">重试</button>
            </div>
            <div v-else-if="stats" class="dashboard-main-content">
              <!-- 活动统计 -->
              <ActivityStats :data="stats.contributionGraph || []" />

              <!-- 对话趋势图 -->
              <TrendChart
                :data="stats.contributionGraph || []"
                title="对话趋势"
              />

              <!-- GitHub 风格热力图 -->
              <ContributionGraph :data="stats.contributionGraph || []" />

              <!-- 项目分布饼图 -->
              <div class="dashboard-chart-section">
                <ProjectPieChart :data="stats.projectStats || []" />
              </div>

              <!-- 扩展统计图表 -->
              <StatsCharts
                :monthly-trends="stats.monthlyTrends || []"
                :hourly-distribution="stats.hourlyDistribution || []"
                :day-of-week-distribution="stats.dayOfWeekDistribution || []"
                :avg-message-count="stats.avgMessageCount || 0"
                :total-sessions="stats.totalSessions || 0"
              />

              <!-- 最近访问的会话 -->
              <RecentSessions
                v-if="stats.recentSessions && stats.recentSessions.length > 0"
                :data="stats.recentSessions"
                @click="handleRecentSessionClick"
              />
            </div>
            <div v-else class="dashboard-empty">
              <div class="empty-icon">📊</div>
              <p>暂无统计数据</p>
            </div>
          </div>

          <!-- 搜索预览窗格 -->
          <div
            v-if="currentView === 'search' && selectedSearchResult"
            class="preview-pane"
          >
            <div class="preview-header">
              <div class="preview-info">
                <span class="preview-project">{{
                  selectedSearchResult.projectName
                }}</span>
                <span
                  class="preview-session"
                  :title="selectedSearchResult.sessionId"
                >
                  {{ selectedSearchResult.sessionId.slice(0, 12) }}
                </span>
              </div>
              <button
                class="preview-jump-btn"
                @click="selectSearchResult(selectedSearchResult, true)"
              >
                在完整视图中打开 →
              </button>
            </div>

            <div v-if="previewLoading" class="preview-loading">加载中...</div>
            <div v-else-if="previewMessages.length === 0" class="preview-empty">
              <div class="empty-icon">📭</div>
              <p>暂无对话内容</p>
            </div>
            <div v-else class="preview-messages">
              <div
                v-for="(message, index) in previewMessages"
                :key="index"
                class="preview-message"
                :class="message.role"
              >
                <div class="preview-message-role">
                  {{ message.role === "user" ? "You" : "Claude" }}
                </div>
                <div class="preview-message-content">
                  <MarkdownRenderer :content="message.content" />
                </div>
              </div>
            </div>
          </div>

          <!-- 搜索欢迎页 -->
          <div
            v-if="currentView === 'search' && !selectedSearchResult"
            class="welcome-screen"
          >
            <div class="welcome-icon">🔍</div>
            <h1 class="welcome-title">全局搜索</h1>
            <p class="welcome-subtitle">在左侧输入关键词搜索对话</p>
            <p class="welcome-hint">单击搜索结果预览，双击跳转到完整视图</p>
          </div>

          <!-- 欢迎页 -->
          <div
            v-if="!selectedSession && currentView === 'projects'"
            class="welcome-screen"
          >
            <div class="welcome-icon">💬</div>
            <h1 class="welcome-title">Claude 历史记录管理器</h1>
            <p class="welcome-subtitle">请从左侧选择项目和会话来查看对话详情</p>
            <div class="shortcut-hint">
              <span class="hint-icon">⌘</span>
              <span class="hint-key">K</span>
              <span class="hint-text">全局搜索</span>
            </div>
          </div>

          <!-- 对话详情 -->
          <div
            v-if="selectedSession && currentView === 'projects'"
            class="chat-view"
          >
            <div class="chat-header">
              <div class="chat-info">
                <span class="chat-project">{{ selectedProject?.name }}</span>
                <span class="chat-session">{{
                  selectedSession?.id.slice(0, 12)
                }}</span>
              </div>
              <button v-if="selectedSession" class="export-btn" title="导出 Markdown" @click="exportSession(selectedSession)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                导出
              </button>
            </div>

            <div v-if="loadingMessages" class="loading">加载对话中...</div>
            <div v-else-if="errorMessages" class="error-state" role="alert">
              <p>{{ errorMessages }}</p>
              <button class="retry-btn" @click="selectedSession && fetchSessionDetail(selectedSession.path)">重试</button>
            </div>
            <div v-else-if="messages.length === 0" class="empty-messages">
              <div class="empty-icon">📭</div>
              <p>暂无对话内容</p>
            </div>
            <div v-else class="messages-wrapper">
              <!-- 时间轴 -->
              <div class="timeline"></div>

              <div class="messages">
                <div
                  v-for="(message, index) in messages"
                  :key="index"
                  class="message"
                  :class="message.role"
                >
                  <div class="message-timeline-point"></div>
                  <div class="message-content">
                    <div class="message-header">
                      <span class="message-role">
                        {{ message.role === "user" ? "You" : "Claude" }}
                      </span>
                      <span class="message-index">#{{ index + 1 }}</span>
                    </div>
                    <div class="message-body">
                      <MarkdownRenderer :content="message.content" />
                    </div>
                    <!-- 工具调用折叠面板 -->
                    <div
                      v-if="message.toolCalls && message.toolCalls.length > 0"
                      class="tool-calls-terminal"
                    >
                      <details class="terminal-panel">
                        <summary class="terminal-header">
                          <span class="terminal-prompt">$</span>
                          <span class="terminal-text">工具调用</span>
                          <span class="terminal-badge">{{
                            message.toolCalls.length
                          }}</span>
                        </summary>
                        <div class="terminal-body">
                          <div
                            v-for="(toolCall, toolIndex) in message.toolCalls"
                            :key="toolIndex"
                            class="terminal-command"
                          >
                            <div class="command-header">
                              <span class="command-prompt">➜</span>
                              <code class="command-name">{{
                                toolCall.function.name
                              }}</code>
                              <button
                                v-if="toolCall.function.name === 'Bash'"
                                class="copy-command-btn"
                                @click="
                                  copyToClipboard(
                                    toolCall.function.arguments,
                                    '命令',
                                  )
                                "
                                title="复制命令"
                              >
                                复制
                              </button>
                            </div>
                            <pre class="command-args">{{
                              toolCall.function.arguments
                            }}</pre>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: var(--bg-primary);
  font-family: var(--font-sans);
  color: var(--text-primary);
  font-size: 14px;
  overflow: hidden;
}

/* ── Left Icon Nav ── */
.nav-bar {
  width: 52px;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 12px;
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 2px;
}

.nav-bar .logo {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
  background: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  outline: none;
  flex-shrink: 0;
}

.nav-btn:hover {
  color: var(--text-primary);
  background: var(--hover-bg);
}

.nav-btn.active {
  color: var(--accent-color);
  background: var(--accent-bg);
}

.theme-toggle {
  margin-top: auto;
  opacity: 0.6;
}
.theme-toggle:hover { opacity: 1; }

/* ── Panels ── */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-left: auto;
  flex-shrink: 0;
}
.icon-btn:hover {
  color: var(--accent-color);
  background: var(--accent-bg);
}
.project-panel {
  width: 170px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.conv-panel {
  width: 210px;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.search-panel {
  width: 360px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.panel-title {
  padding: 14px 14px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  user-select: none;
}

.badge {
  background: var(--accent-bg);
  color: var(--accent-color);
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 10px;
}

.panel-list {
  flex: 1;
  overflow-y: auto;
}

/* ── Project Items ── */
.project-item {
  padding: 8px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-primary);
  border-left: 2px solid transparent;
  transition: all var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  font-size: 13px;
}

.project-item:hover {
  background: var(--hover-bg);
  border-left-color: var(--accent-color);
}

.project-item.active {
  background: var(--accent-bg);
  border-left-color: var(--accent-color);
  font-weight: 500;
}

.project-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}

.chevron {
  flex-shrink: 0;
  opacity: 0.5;
  color: var(--accent-color);
}

/* ── Session Items ── */
.conv-item {
  padding: 10px 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border-left: 2px solid transparent;
}

.conv-item:hover {
  background: var(--hover-bg);
  border-left-color: var(--accent-color);
}

.conv-item.active {
  background: var(--accent-bg);
  border-left-color: var(--accent-color);
}

.conv-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.conv-hash {
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--bg-primary);
  color: var(--text-muted);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.conv-time {
  font-size: 11px;
  color: var(--text-muted);
}

.conv-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.conv-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.conv-badge {
  flex-shrink: 0;
}

.conv-item { position: relative; }
.conv-item .conv-actions {
  display: none;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  gap: 4px;
  background: var(--card-bg);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
}
.conv-item:hover .conv-actions { display: flex; }

.mini-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.mini-btn:hover {
  color: var(--accent-color);
  border-color: var(--accent-color);
}
.mini-btn--danger:hover {
  color: var(--danger-color);
  border-color: var(--danger-color);
  background: rgba(248, 81, 73, 0.08);
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.export-btn:hover {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: var(--accent-bg);
}

/* ── Search ── */
.search-view-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

.search-view-input {
  flex-shrink: 0;
}

.search-results-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
}

/* ── Main Content ── */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.main-pane {
  flex: 1;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* ── Welcome Screen ── */
.welcome-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  overflow: hidden;
  min-height: 0;
}

.welcome-icon {
  font-size: 56px;
  margin-bottom: 20px;
  opacity: 0.7;
}

.welcome-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.welcome-subtitle {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.welcome-hint {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-muted);
}

.shortcut-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
}

.hint-icon {
  font-size: 15px;
  color: var(--accent-color);
}

.hint-key {
  padding: 2px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-color);
}

.hint-text {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ── Chat View ── */
.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.chat-header {
  height: 48px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 8px;
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.chat-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-project {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.chat-session {
  background: var(--bg-primary);
  color: var(--text-muted);
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

/* ── Messages ── */
.messages-wrapper {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  min-height: 0;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 22px;
  animation: fadeInUp 0.3s ease-out forwards;
  opacity: 0;
}

.message-timeline-point {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 8px;
}

.message.user .message-timeline-point {
  background: var(--accent-color);
}

.message.assistant .message-timeline-point {
  background: var(--success-color);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.message-role {
  font-size: 13px;
  font-weight: 600;
}

.message.user .message-role {
  color: var(--accent-color);
}

.message.assistant .message-role {
  color: var(--success-color);
}

.message-index {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.message-body {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
}

.message.user .message-body {
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border-left: 3px solid var(--accent-color);
}

/* ── Tool Calls ── */
.tool-calls-terminal {
  margin-top: 8px;
}

.terminal-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast);
}

.terminal-panel:hover {
  border-color: var(--accent-color);
}

.terminal-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
  background: var(--bg-tertiary);
  transition: background var(--transition-fast);
  list-style: none;
}

.terminal-header::-webkit-details-marker {
  display: none;
}

.terminal-header:hover {
  background: var(--hover-bg);
}

.terminal-prompt {
  color: var(--accent-color);
  font-size: 12px;
  font-weight: 600;
}

.terminal-text {
  color: var(--text-primary);
  font-size: 12px;
}

.terminal-badge {
  background: var(--accent-bg);
  color: var(--accent-color);
  font-size: 10px;
  font-weight: 600;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
}

.terminal-body {
  padding: 10px 14px;
  max-height: 300px;
  overflow-y: auto;
}

.terminal-command {
  margin-bottom: 8px;
}

.terminal-command:last-child {
  margin-bottom: 0;
}

.command-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.command-prompt {
  color: var(--accent-color);
  font-family: var(--font-mono);
  font-size: 11px;
}

.command-name {
  color: var(--success-color);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
}

.copy-command-btn {
  margin-left: auto;
  padding: 2px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.copy-command-btn:hover {
  background: var(--accent-bg);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.command-args {
  margin: 0;
  padding: 10px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: var(--font-mono);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 180px;
  overflow-y: auto;
  color: var(--text-primary);
}

/* ── Dashboard ── */
.dashboard-main {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.dashboard-loading,
.dashboard-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  min-height: 400px;
}

.dashboard-empty .empty-icon {
  font-size: 56px;
  margin-bottom: 14px;
  opacity: 0.5;
}

.dashboard-main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-chart-section {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 20px;
}

/* ── State Messages ── */
.loading,
.empty-text {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.empty-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  overflow: hidden;
  min-height: 0;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 14px;
  opacity: 0.5;
}

.empty-messages p {
  font-size: 14px;
}

/* ── Search Results ── */
.search-result-item {
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.search-result-item:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color);
}

.search-result-item.selected {
  background: var(--accent-bg);
  border-color: var(--accent-color);
}

.search-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.search-project {
  font-weight: 600;
  color: var(--text-primary);
}

.search-session {
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
}

.search-session-id {
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
}

.search-preview {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.search-loading,
.search-empty,
.search-hint {
  padding: 16px 24px;
  color: var(--text-muted);
  font-size: 14px;
}
.search-hint p { text-align: center; padding: 8px 0; }

.search-history {
  text-align: left;
}
.search-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  padding: 0 4px;
}
.search-history-clear {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: 11px;
  font-family: var(--font-sans);
}
.search-history-clear:hover { text-decoration: underline; }
.search-history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.search-history-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}
.search-history-item svg { flex-shrink: 0; color: var(--text-muted); }

.search-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.search-result-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-highlight {
  background: rgba(83, 155, 245, 0.2);
  color: var(--accent-color);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}

/* ── Preview Pane ── */
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.preview-header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.preview-project {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.preview-session {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  padding: 2px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.preview-jump-btn {
  padding: 6px 14px;
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.preview-jump-btn:hover {
  background: var(--accent-hover);
}

.preview-loading,
.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  overflow: hidden;
  min-height: 0;
}

.preview-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  min-height: 0;
}

.preview-message {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
}

.preview-message-role {
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  width: 44px;
  margin-top: 8px;
}

.preview-message.user .preview-message-role {
  color: var(--accent-color);
}

.preview-message.assistant .preview-message-role {
  color: var(--success-color);
}

.preview-message-content {
  color: var(--text-primary);
  line-height: 1.6;
  font-size: 13px;
  flex: 1;
  min-width: 0;
}

.preview-message-content :deep(p) {
  margin: 0.5em 0;
}

.preview-message-content :deep(code) {
  background: var(--bg-tertiary);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
  font-size: 0.85em;
  color: var(--accent-color);
}

.preview-message-content :deep(pre) {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px;
  overflow-x: auto;
}

/* ── Shortcuts Dialog ── */
.shortcuts-list {
  display: flex;
  flex-direction: column;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-color);
  transition: background var(--transition-fast);
}

.shortcut-item:hover {
  background: var(--hover-bg);
}

.shortcut-item:last-child {
  border-bottom: none;
}

.shortcut-key kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-color);
  min-width: 52px;
}

.shortcut-desc {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 1px;
}

.shortcut-action {
  font-size: 12px;
  color: var(--text-muted);
}

.shortcuts-footer {
  padding: 14px 18px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.shortcuts-footer p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.shortcuts-footer kbd {
  padding: 3px 7px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  margin: 0 2px;
  color: var(--accent-color);
}

/* ── Element Plus Overrides ── */
:deep(.el-dialog) {
  background: var(--bg-primary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid var(--border-color);
  padding: 16px 20px;
}

:deep(.el-dialog__title) {
  color: var(--text-primary) !important;
  font-size: 15px !important;
  font-weight: 600 !important;
}

:deep(.el-dialog__body) {
  padding: 16px;
}

:deep(.el-dialog__headerbtn) {
  color: var(--text-muted) !important;
}

:deep(.el-input__wrapper) {
  background: var(--input-bg) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-md) !important;
  transition: border-color var(--transition-fast) !important;
}

:deep(.el-input__wrapper:hover) {
  border-color: var(--accent-color) !important;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent-color) !important;
  box-shadow: var(--accent-glow) !important;
}

:deep(.el-input__inner) {
  color: var(--text-primary) !important;
  font-family: var(--font-sans) !important;
}

:deep(.el-input__inner::placeholder) {
  color: var(--text-muted) !important;
}

/* ── Error state ── */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  flex: 1;
  min-height: 120px;
}

.retry-btn {
  padding: 6px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--accent-color);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.retry-btn:hover {
  border-color: var(--accent-color);
  background: var(--accent-bg);
}

/* ── Utility: view transitions ── */
.pane-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
</style>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

#app {
  height: 100vh;
  width: 100vw;
}
</style>
