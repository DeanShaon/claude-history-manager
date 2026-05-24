<script setup lang="ts">
import { computed } from "vue";

interface Props {
  monthlyTrends: { month: string; count: number }[];
  hourlyDistribution: { hour: number; count: number }[];
  dayOfWeekDistribution: { day: number; count: number }[];
  avgMessageCount: number;
  totalSessions: number;
}

const props = defineProps<Props>();

const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];
const maxMonthly = computed(() => Math.max(1, ...props.monthlyTrends.map(d => d.count)));
const maxHourly = computed(() => Math.max(1, ...props.hourlyDistribution.map(d => d.count)));
const maxDow = computed(() => Math.max(1, ...props.dayOfWeekDistribution.map(d => d.count)));

const fullHours = computed(() => {
  const map = new Map(props.hourlyDistribution.map(d => [d.hour, d.count]));
  return Array.from({ length: 24 }, (_, i) => ({ hour: i, count: map.get(i) || 0 }));
});

const fullDow = computed(() => {
  const map = new Map(props.dayOfWeekDistribution.map(d => [d.day, d.count]));
  return Array.from({ length: 7 }, (_, i) => ({ day: i, label: dayLabels[i], count: map.get(i) || 0 }));
});

const last12Months = computed(() => {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  const map = new Map(props.monthlyTrends.map(d => [d.month, d.count]));
  return months.map(m => ({ month: m, count: map.get(m) || 0, label: m.slice(5) + "月" }));
});
</script>

<template>
  <div class="stats-charts">
    <!-- Avg message count card -->
    <div class="stat-card-row">
      <div class="stat-card">
        <div class="stat-card-value">{{ avgMessageCount }}</div>
        <div class="stat-card-label">平均消息数/会话</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">{{ totalSessions }}</div>
        <div class="stat-card-label">总会话数</div>
      </div>
    </div>

    <!-- Monthly trend bar chart -->
    <div class="chart-section">
      <h3 class="chart-title">月度趋势</h3>
      <div class="bar-chart">
        <div v-for="d in last12Months" :key="d.month" class="bar-col">
          <div class="bar-value">{{ d.count || "" }}</div>
          <div class="bar-fill-wrap">
            <div
              class="bar-fill"
              :style="{ height: (d.count / maxMonthly * 100) + '%' }"
            />
          </div>
          <div class="bar-label">{{ d.label }}</div>
        </div>
      </div>
    </div>

    <div class="chart-row">
      <!-- Hourly distribution -->
      <div class="chart-section chart-half">
        <h3 class="chart-title">时段分布</h3>
        <div class="bar-chart bar-chart--sm">
          <div v-for="d in fullHours" :key="d.hour" class="bar-col">
            <div class="bar-fill-wrap">
              <div
                class="bar-fill"
                :style="{ height: (d.count / maxHourly * 100) + '%' }"
              />
            </div>
            <div class="bar-label">{{ d.hour }}h</div>
          </div>
        </div>
      </div>

      <!-- Day of week distribution -->
      <div class="chart-section chart-half">
        <h3 class="chart-title">星期分布</h3>
        <div class="dow-chart">
          <div v-for="d in fullDow" :key="d.day" class="dow-row">
            <span class="dow-label">周{{ d.label }}</span>
            <div class="dow-bar-wrap">
              <div
                class="dow-bar"
                :style="{ width: (d.count / maxDow * 100) + '%' }"
              />
            </div>
            <span class="dow-count">{{ d.count }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-charts {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stat-card-row {
  display: flex;
  gap: 16px;
}

.stat-card {
  flex: 1;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  text-align: center;
}

.stat-card-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--accent-color);
  line-height: 1.2;
}

.stat-card-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.chart-section {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.chart-row {
  display: flex;
  gap: 16px;
}

.chart-half {
  flex: 1;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 160px;
}

.bar-chart--sm {
  height: 120px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  min-width: 0;
}

.bar-value {
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 2px;
  min-height: 14px;
}

.bar-fill-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 1px;
}

.bar-fill {
  width: 100%;
  max-width: 24px;
  background: var(--accent-color);
  border-radius: 2px 2px 0 0;
  min-height: 2px;
  transition: height var(--transition-normal);
  opacity: 0.8;
}

.bar-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
  white-space: nowrap;
}

.dow-chart {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dow-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dow-label {
  width: 32px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
  flex-shrink: 0;
}

.dow-bar-wrap {
  flex: 1;
  height: 20px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.dow-bar {
  height: 100%;
  background: var(--secondary-accent);
  border-radius: var(--radius-sm);
  transition: width var(--transition-normal);
  opacity: 0.75;
}

.dow-count {
  width: 24px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: left;
  flex-shrink: 0;
}
</style>
