<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const containerRef = ref<HTMLElement | null>(null);
import { marked } from 'marked';
import hljs from 'highlight.js';
import { ElMessage } from 'element-plus';

interface Props {
  content: string;
}

const props = defineProps<Props>();

// 全屏代码块状态
const fullscreenCode = ref<{ code: string; lang: string } | null>(null);

// 复制代码到剪贴板
const copyCode = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code);
    ElMessage.success({ message: '代码已复制', duration: 1500, plain: true });
  } catch (err) {
    console.error('复制失败:', err);
    ElMessage.error('复制失败');
  }
};

// 打开全屏
const openFullscreen = (code: string, lang: string) => {
  fullscreenCode.value = { code, lang };
};

// 关闭全屏
const closeFullscreen = () => {
  fullscreenCode.value = null;
};

// 配置 marked 使用 highlight.js
marked.use({
  renderer: {
    code({ text, lang }: any) {
      const language = lang || 'text';
      let highlighted: string;
      if (lang && hljs.getLanguage(lang)) {
        try {
          highlighted = hljs.highlight(text, { language: lang }).value;
        } catch (err) {
          console.error('代码高亮失败:', err);
          highlighted = text;
        }
      } else {
        highlighted = hljs.highlightAuto(text).value;
      }
      return `<pre><code class="language-${language}">${highlighted}</code></pre>`;
    }
  }
});

marked.setOptions({
  breaks: true,
  gfm: true,
});

// 渲染后的 HTML
const renderedContent = ref('');

// 监听内容变化，重新渲染
watch(
  () => props.content,
  (newContent) => {
    renderedContent.value = marked.parse(newContent) as string;
    // 渲染后为代码块添加复制按钮
    nextTick(() => {
      addCopyButtons();
    });
  },
  { immediate: true }
);

// 为代码块添加复制按钮和语言标签
const addCopyButtons = () => {
  if (!containerRef.value) return;
  const preElements = containerRef.value.querySelectorAll('pre');
  preElements.forEach((pre) => {
    // 检查是否已经有工具栏
    if (pre.querySelector('.code-toolbar')) return;

    const codeElement = pre.querySelector('code');
    if (!codeElement) return;

    // 获取语言
    const lang = codeElement.className.replace(/language-/, '') || 'text';
    const code = codeElement.textContent || '';

    // 创建工具栏
    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';

    // 语言标签
    const langTag = document.createElement('span');
    langTag.className = 'code-lang';
    langTag.textContent = lang;

    // 按钮容器
    const btnContainer = document.createElement('div');
    btnContainer.className = 'code-toolbar-buttons';

    // 全屏按钮
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'code-fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.title = '全屏查看';
    fullscreenBtn.onclick = () => {
      openFullscreen(code, lang);
    };

    // 复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = () => {
      copyCode(code);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    };

    toolbar.appendChild(langTag);
    btnContainer.appendChild(fullscreenBtn);
    btnContainer.appendChild(copyBtn);
    toolbar.appendChild(btnContainer);
    pre.insertBefore(toolbar, pre.firstChild);
  });
};
</script>

<template>
  <div ref="containerRef" class="markdown-renderer" v-html="renderedContent"></div>

  <!-- 全屏代码查看器 -->
  <teleport to="body">
    <transition name="fullscreen">
      <div v-if="fullscreenCode" class="fullscreen-code-modal" @click="closeFullscreen">
        <div class="fullscreen-code-container" @click.stop>
          <div class="fullscreen-header">
            <div class="fullscreen-lang">{{ fullscreenCode.lang }}</div>
            <div class="fullscreen-actions">
              <button class="fullscreen-action-btn" @click="copyCode(fullscreenCode.code)" title="复制代码">
                📋 复制
              </button>
              <button class="fullscreen-action-btn" @click="closeFullscreen" title="关闭">
                ✕ 关闭
              </button>
            </div>
          </div>
          <div class="fullscreen-code-content">
            <pre><code class="language-{{ fullscreenCode.lang }}">{{ fullscreenCode.code }}</code></pre>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
@import 'highlight.js/styles/atom-one-dark.css';

.markdown-renderer {
  line-height: 1.75;
  color: var(--text-primary);
}

.markdown-renderer :deep(h1),
.markdown-renderer :deep(h2),
.markdown-renderer :deep(h3),
.markdown-renderer :deep(h4),
.markdown-renderer :deep(h5),
.markdown-renderer :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.6em;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.markdown-renderer :deep(h1) {
  font-size: 1.6em;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.3em;
}

.markdown-renderer :deep(h2) {
  font-size: 1.4em;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.3em;
}

.markdown-renderer :deep(h3) {
  font-size: 1.25em;
}

.markdown-renderer :deep(h4) {
  font-size: 1.1em;
}

.markdown-renderer :deep(p) {
  margin: 0.75em 0;
  color: var(--text-primary);
}

.markdown-renderer :deep(code) {
  background: var(--accent-bg);
  padding: 0.2em 0.45em;
  border-radius: var(--radius-sm);
  font-size: 0.88em;
  font-family: var(--font-mono);
  color: var(--accent-color);
}

.markdown-renderer :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.markdown-renderer :deep(pre) {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 1em 0;
  position: relative;
  transition: border-color var(--transition-fast);
}

.markdown-renderer :deep(pre:hover) {
  border-color: var(--accent-color);
}

.markdown-renderer :deep(pre code) {
  background: transparent;
  padding: 14px 12px;
  font-size: 13px;
  line-height: 1.6;
  border: none;
  color: var(--text-primary);
}

.markdown-renderer :deep(.code-toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.markdown-renderer :deep(.code-lang) {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.markdown-renderer :deep(.code-toolbar-buttons) {
  display: flex;
  gap: 6px;
}

.markdown-renderer :deep(.code-copy-btn) {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.markdown-renderer :deep(.code-copy-btn:hover) {
  background: var(--accent-bg);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.markdown-renderer :deep(.code-copy-btn:active) {
  transform: scale(0.96);
}

.markdown-renderer :deep(.code-fullscreen-btn) {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1;
}

.markdown-renderer :deep(.code-fullscreen-btn:hover) {
  background: var(--accent-bg);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.markdown-renderer :deep(ul),
.markdown-renderer :deep(ol) {
  margin: 0.75em 0;
  padding-left: 2em;
}

.markdown-renderer :deep(li) {
  margin: 0.3em 0;
  color: var(--text-primary);
}

.markdown-renderer :deep(blockquote) {
  border-left: 3px solid var(--accent-color);
  margin: 1em 0;
  padding: 4px 14px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.markdown-renderer :deep(blockquote p) {
  margin: 0;
  padding: 4px 0;
}

.markdown-renderer :deep(a) {
  color: var(--accent-color);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.markdown-renderer :deep(a:hover) {
  text-decoration: underline;
  color: var(--accent-hover);
}

.markdown-renderer :deep(table) {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.markdown-renderer :deep(th),
.markdown-renderer :deep(td) {
  border: 1px solid var(--border-color);
  padding: 10px 14px;
  text-align: left;
}

.markdown-renderer :deep(th) {
  background: var(--bg-tertiary);
  font-weight: 600;
  color: var(--text-primary);
}

.markdown-renderer :deep(td) {
  color: var(--text-primary);
}

.markdown-renderer :deep(tr:hover td) {
  background: var(--hover-bg);
}

.markdown-renderer :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  margin: 0.75em 0;
}

.markdown-renderer :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 1.5em 0;
}

.markdown-renderer :deep(code[class*="language-"]) {
  background: transparent;
  border: none;
  color: var(--text-primary);
}

/* Fullscreen Code Viewer */
.fullscreen-code-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  cursor: pointer;
}

.fullscreen-code-container {
  width: 100%;
  max-width: 1400px;
  height: calc(100% - 80px);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: default;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}

.fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.fullscreen-lang {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

.fullscreen-actions {
  display: flex;
  gap: 8px;
}

.fullscreen-action-btn {
  padding: 6px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fullscreen-action-btn:hover {
  background: var(--accent-bg);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.fullscreen-code-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.fullscreen-code-content pre {
  margin: 0;
  background: transparent;
  border: none;
}

.fullscreen-code-content code {
  background: transparent;
  padding: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
}

.fullscreen-enter-active,
.fullscreen-leave-active {
  transition: opacity 0.2s ease;
}

.fullscreen-enter-from,
.fullscreen-leave-to {
  opacity: 0;
}

.fullscreen-enter-active .fullscreen-code-container,
.fullscreen-leave-active .fullscreen-code-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.fullscreen-enter-from .fullscreen-code-container,
.fullscreen-leave-to .fullscreen-code-container {
  transform: scale(0.96);
  opacity: 0;
}
</style>
