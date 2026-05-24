<script setup lang="ts">
import { computed } from 'vue';

interface SessionData {
  sessionId: string;
  projectName: string;
  projectPath: string;
  filePath: string;
  modifiedAt: Date;
  messageCount: number;
  summary?: string;
}

interface Props {
  data: SessionData[];
}

const props = defineProps<Props>();

// 格式化时间
const formatTime = (date: Date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

// 生成会话标题摘要
const getSessionSummary = (sessionId: string, projectName: string) => {
  return `${projectName}`;
};

// 定义 emit
const emit = defineEmits<{
  (e: 'click', session: SessionData): void;
}>();
</script>

<template>
  <div class="recent-sessions">
    <div class="section-header">
      <h3 class="section-title">最近访问</h3>
      <span class="section-count">{{ data.length }}</span>
    </div>

    <div v-if="data.length === 0" class="empty-state">
      <div class="empty-icon">🕐</div>
      <p class="empty-text">暂无最近访问记录</p>
    </div>

    <div v-else class="sessions-list">
      <div
        v-for="(session, index) in data"
        :key="session.sessionId"
        class="session-card"
        @click="emit('click', session)"
      >
        <div class="session-rank">{{ index + 1 }}</div>
        <div class="session-content">
          <div class="session-project">{{ session.projectName }}</div>
          <div class="session-info">
            <span class="session-summary">{{ session.summary || '无简介' }}</span>
            <span class="session-messages">{{ session.messageCount }} 条消息</span>
          </div>
        </div>
        <div class="session-meta">
          <span class="session-time">{{ formatTime(session.modifiedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recent-sessions {
  padding: 24px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-count {
  padding: 2px 10px;
  background: var(--accent-bg);
  color: var(--accent-color);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 13px;
  margin: 0;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.session-card:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color);
}

.session-rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}

.session-card:nth-child(1) .session-rank {
  background: rgba(83, 155, 245, 0.15);
  border-color: rgba(83, 155, 245, 0.4);
  color: var(--accent-color);
}

.session-content {
  flex: 1;
  min-width: 0;
}

.session-project {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-summary {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.session-messages {
  font-size: 11px;
  color: var(--accent-color);
  font-weight: 500;
}

.session-meta {
  flex-shrink: 0;
}

.session-time {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
