<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  data: { date: string; count: number }[];
}

const props = defineProps<Props>();

// 计算统计数据
const stats = computed(() => {
  if (!props.data || !Array.isArray(props.data)) {
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      total: 0,
      avgDaily: 0,
      bestDay: { date: '', count: 0 }
    };
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 获取本周的日期范围
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // 获取本月的第一天
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  let todayCount = 0;
  let thisWeekCount = 0;
  let thisMonthCount = 0;
  let totalCount = 0;
  let bestDay = { date: '', count: 0 };
  const dayCounts: number[] = [];

  props.data.forEach(item => {
    const itemDate = new Date(item.date);
    const dateStr = item.date;
    const count = typeof item.count === 'number' ? item.count : 0;

    totalCount += count;
    dayCounts.push(count);

    // 今日统计
    if (dateStr === todayStr) {
      todayCount += count;
    }

    // 本周统计
    if (itemDate >= weekStart && itemDate <= weekEnd) {
      thisWeekCount += count;
    }

    // 本月统计
    if (itemDate >= monthStart && itemDate <= today) {
      thisMonthCount += count;
    }

    // 最多的一天
    if (count > bestDay.count) {
      bestDay = { date: dateStr, count };
    }
  });

  // 计算平均每日对话数（有数据的日期）
  const daysWithData = dayCounts.filter(c => c > 0).length || 1;
  const avgDaily = Math.round(totalCount / daysWithData);

  return {
    today: todayCount,
    thisWeek: thisWeekCount,
    thisMonth: thisMonthCount,
    total: totalCount,
    avgDaily,
    bestDay
  };
});

// 格式化日期
const formatDate = (date: string) => {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
};

// 计算环比增长
const getGrowth = (current: number, previous: number) => {
  if (previous === 0) return null;
  const growth = ((current - previous) / previous) * 100;
  return {
    value: growth.toFixed(1),
    isPositive: growth >= 0
  };
};

// 计算昨日数据用于对比
const yesterdayCount = computed(() => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const item = props.data?.find(d => d.date === yesterdayStr);
  return item?.count || 0;
});

const todayGrowth = computed(() => getGrowth(stats.value.today, yesterdayCount.value));

// 计算上周数据用于对比
const lastWeekCount = computed(() => {
  const today = new Date();
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

  return props.data?.reduce((sum, item) => {
    const itemDate = new Date(item.date);
    if (itemDate >= lastWeekStart && itemDate <= lastWeekEnd) {
      return sum + (item.count || 0);
    }
    return sum;
  }, 0) || 0;
});

const weekGrowth = computed(() => getGrowth(stats.value.thisWeek, lastWeekCount.value));
</script>

<template>
  <div class="activity-stats">
    <div class="section-header">
      <h3 class="section-title">活动统计</h3>
    </div>

    <div class="stats-grid">
      <!-- 今日对话 -->
      <div class="stat-item">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-label">今日对话</div>
          <div class="stat-value">{{ stats.today }}</div>
          <div class="stat-change" v-if="todayGrowth">
            <span :class="todayGrowth.isPositive ? 'positive' : 'negative'">
              {{ todayGrowth.isPositive ? '↑' : '↓' }} {{ todayGrowth.value }}%
            </span>
            <span class="change-label">较昨日</span>
          </div>
        </div>
      </div>

      <!-- 本周对话 -->
      <div class="stat-item">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-label">本周对话</div>
          <div class="stat-value">{{ stats.thisWeek }}</div>
          <div class="stat-change" v-if="weekGrowth">
            <span :class="weekGrowth.isPositive ? 'positive' : 'negative'">
              {{ weekGrowth.isPositive ? '↑' : '↓' }} {{ weekGrowth.value }}%
            </span>
            <span class="change-label">较上周</span>
          </div>
        </div>
      </div>

      <!-- 本月对话 -->
      <div class="stat-item">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <div class="stat-label">本月对话</div>
          <div class="stat-value">{{ stats.thisMonth }}</div>
          <div class="stat-extra">
            <span class="extra-label">累计</span>
          </div>
        </div>
      </div>

      <!-- 平均每日 -->
      <div class="stat-item">
        <div class="stat-icon">🎯</div>
        <div class="stat-content">
          <div class="stat-label">平均每日</div>
          <div class="stat-value">{{ stats.avgDaily }}</div>
          <div class="stat-extra">
            <span class="extra-label">有记录日均</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 最佳一天 -->
    <div v-if="stats.bestDay.count > 0" class="best-day">
      <div class="best-day-label">最活跃的一天</div>
      <div class="best-day-content">
        <span class="best-day-date">{{ formatDate(stats.bestDay.date) }}</span>
        <span class="best-day-count">{{ stats.bestDay.count }} 条对话</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-stats {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 24px;
}

.section-header {
  margin-bottom: 22px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.stat-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 16px;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.stat-item:hover {
  border-color: var(--accent-color);
  background: var(--bg-tertiary);
}

.stat-icon {
  font-size: 28px;
  line-height: 1;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent-color);
  line-height: 1.2;
  margin-bottom: 4px;
}

.stat-change {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.stat-change .positive {
  color: var(--success-color);
  font-weight: 600;
}

.stat-change .negative {
  color: var(--danger-color);
  font-weight: 600;
}

.change-label {
  color: var(--text-muted);
}

.stat-extra {
  font-size: 11px;
  color: var(--text-muted);
}

.best-day {
  padding: 16px;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: border-color var(--transition-fast);
}

.best-day:hover {
  border-color: var(--accent-color);
}

.best-day-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.best-day-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.best-day-date {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.best-day-count {
  font-size: 16px;
  color: var(--accent-color);
  font-weight: 700;
}
</style>
