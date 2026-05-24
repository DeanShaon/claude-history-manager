<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  data: { name: string; count: number }[];
}

const props = defineProps<Props>();

// Clean color palette
const colors = [
  '#539bf5',
  '#7c6ff7',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#54aeff',
  '#6e7681',
  '#8b949e',
  '#a371f7',
  '#e5534b',
  '#4ac26b',
  '#b7802c',
];

// 为每个项目分配颜色
const chartData = computed(() => {
  // 确保数据存在且有效
  if (!props.data || !Array.isArray(props.data)) {
    return [];
  }
  return props.data
    .filter(item => item && typeof item.count === 'number' && item.count >= 0)
    .map((item, index) => ({
      name: item.name || 'Unknown',
      count: item.count,
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
});

// 计算总数
const total = computed(() => {
  if (chartData.value.length === 0) return 0;
  return chartData.value.reduce((sum, d) => {
    const count = typeof d.count === 'number' ? d.count : 0;
    return sum + count;
  }, 0);
});

// 计算百分比
const getPercentage = (count: number) => {
  return total.value > 0 ? ((count / total.value) * 100).toFixed(1) : '0.0';
};

// 生成饼图路径
const pieSegments = computed(() => {
  let currentAngle = 0;
  const radius = 100;
  const centerX = 120;
  const centerY = 120;

  return chartData.value.map((item) => {
    const percentage = item.count / total.value;
    const angle = percentage * 360;

    // 计算路径
    const startAngle = currentAngle * (Math.PI / 180);
    const endAngle = (currentAngle + angle) * (Math.PI / 180);

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    currentAngle += angle;

    return {
      ...item,
      path,
      percentage: (percentage * 100).toFixed(1),
    };
  });
});</script>

<template>
  <div class="pie-chart">
    <div class="chart-header">
      <h3 class="chart-title">项目活跃度分布</h3>
      <span class="chart-total">总计 {{ total }} 条</span>
    </div>

    <div v-if="chartData.length === 0" class="empty-state">
      <div class="empty-icon">📊</div>
      <p class="empty-text">暂无数据</p>
    </div>

    <div v-else class="chart-container">
      <svg viewBox="0 0 240 240" class="pie-svg">
        <!-- 饼图扇区 -->
        <g v-for="(segment, index) in pieSegments" :key="index"
           class="pie-segment"
           :style="{ '--segment-color': segment.color }">
          <path :d="segment.path" :fill="segment.color" />
        </g>

        <!-- 中心圆（实现环形图效果） -->
        <circle cx="120" cy="120" r="60" fill="var(--bg-secondary)" />
      </svg>

      <!-- 图例 -->
      <div class="legend">
        <div v-for="(item, index) in chartData" :key="index" class="legend-item">
          <span class="legend-dot" :style="{ background: item.color }"></span>
          <span class="legend-name">{{ item.name }}</span>
          <span class="legend-count">{{ item.count }}</span>
          <span class="legend-percent">{{ getPercentage(item.count) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pie-chart {
  padding: 24px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.chart-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-total {
  font-size: 13px;
  color: var(--text-muted);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  margin: 0;
}

.chart-container {
  display: flex;
  align-items: center;
  gap: 40px;
}

.pie-svg {
  width: 240px;
  height: 240px;
  flex-shrink: 0;
}

.pie-segment {
  cursor: pointer;
  transition: all var(--transition-fast);
  stroke: rgba(0, 0, 0, 0.3);
  stroke-width: 1;
}

.pie-segment:hover {
  transform: scale(1.06);
  filter: brightness(1.2);
}

.legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  background: var(--bg-primary);
}

.legend-item:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-count {
  font-size: 13px;
  color: var(--accent-color);
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.legend-percent {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  min-width: 45px;
  text-align: right;
}
</style>
