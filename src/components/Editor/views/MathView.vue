<template>
  <div
    ref="wrapperRef"
    class="math-view-wrapper"
    :class="[
      isBlock ? 'math-view-block' : 'math-view-inline',
      isEditing ? 'is-editing' : '',
      hasError ? 'has-error' : '',
    ]"
    tabindex="0"
    @mousedown.stop="startEditing()"
    @keydown="handleKeyDown"
  >
    <!-- 编辑模式：显示源码 -->
    <div v-if="isEditing" class="math-source" @click.stop="focusInput()">
      <span class="math-delimiter" @click.stop.prevent="focusInput('start')">{{ isBlock ? '$$' : '$' }}</span>
      <textarea
        v-if="isBlock"
        ref="inputRef"
        v-model="latex"
        class="math-source-input math-source-textarea"
        spellcheck="false"
        @keydown.esc.prevent="stopEditing"
        @input="autoResize"
        @click.stop
      ></textarea>
      <input
        v-else
        ref="inputRef"
        v-model="latex"
        class="math-source-input math-source-inline-input"
        spellcheck="false"
        :size="Math.max(latex.length, 1)"
        @keydown.enter.prevent="stopEditing"
        @keydown.esc.prevent="stopEditing"
        @click.stop
      />
      <span class="math-delimiter" @click.stop="$event.preventDefault(); focusInput('end')">{{ isBlock ? '$$' : '$' }}</span>
    </div>

    <!-- 渲染模式 -->
    <template v-else>
      <!-- 渲染成功 -->
      <div v-if="!hasError" ref="renderRef" class="math-render"></div>
      <!-- 渲染失败：显示源码 -->
      <div v-else class="math-fallback">
        <span class="math-delimiter">{{ isBlock ? '$$' : '$' }}</span>
        <code class="math-fallback-code">{{ latex }}</code>
        <span class="math-delimiter">{{ isBlock ? '$$' : '$' }}</span>
        <span class="math-error-badge">渲染错误</span>
      </div>
      <!-- 空公式提示 -->
      <span v-if="!latex" class="math-placeholder">空公式</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: any) => void;
}>();

const wrapperRef = ref<HTMLElement | null>(null);
const isBlock = computed(() => props.node.type.name === 'math_block');
const isEditing = ref(false);
const latex = ref(props.node.attrs.latex || '');
const renderRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | HTMLInputElement | null>(null);
const hasError = ref(false);

const handleClickOutside = (e: MouseEvent) => {
  if (isEditing.value && wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    stopEditing();
  }
};

const focusInput = (pos?: 'start' | 'end' | Event) => {
  // 如果传入的是事件对象，忽略它
  if (pos instanceof Event) {
    pos = undefined;
  }
  if (inputRef.value) {
    inputRef.value.focus();
    if (pos === 'start') {
      inputRef.value.setSelectionRange(0, 0);
    } else if (pos === 'end') {
      const len = latex.value.length;
      inputRef.value.setSelectionRange(len, len);
    }
  }
};

onMounted(() => {
  renderMath();
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});

const handleKeyDown = (e: KeyboardEvent) => {
  // 如果正在编辑，按回车或 ESC 退出编辑
  if (isEditing.value) {
    if (e.key === 'Enter' && !isBlock.value) {
      e.preventDefault();
      stopEditing();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      stopEditing();
    }
    // 在编辑模式下，如果 latex 为空且按退格，则删除整个节点
    if (e.key === 'Backspace' && latex.value === '') {
      // 交给 ProseMirror 处理删除
      return;
    }
    // 允许在编辑框内自由移动和操作
    e.stopPropagation();
    return;
  }

  // 非编辑模式下的按键处理
  if (e.key === 'Backspace') {
    // 非编辑模式下按退格，直接进入编辑模式并把光标放在最后
    e.preventDefault();
    e.stopPropagation();
    startEditing('end');
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    startEditing();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    // 允许方向键在 ProseMirror 中移动选中节点
    return;
  }
};

const renderMath = () => {
  if (!renderRef.value) return;
  
  if (!latex.value) {
    hasError.value = false;
    renderRef.value.innerHTML = '';
    return;
  }
  
  try {
    katex.render(latex.value, renderRef.value, {
      throwOnError: true,
      displayMode: isBlock.value,
      trust: true,
      strict: false
    });
    hasError.value = false;
  } catch (e) {
    console.warn('[MathView] Render error:', e);
    hasError.value = true;
  }
};

const autoResize = () => {
  const el = inputRef.value;
  if (el && el instanceof HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
};

const startEditing = (pos: 'start' | 'end' | 'none' = 'none') => {
  if (isEditing.value) return;
  isEditing.value = true;
  
  nextTick(() => {
    const el = inputRef.value;
    if (el) {
      el.focus();
      if (pos === 'end') {
        const len = latex.value.length;
        el.setSelectionRange(len, len);
      } else if (pos === 'start') {
        el.setSelectionRange(0, 0);
      }
      // 如果是 none，保持默认 focus 行为（通常是全选或起始位，取决于浏览器）
      
      if (el instanceof HTMLTextAreaElement) {
        autoResize();
      }
    }
  });
};

const stopEditing = () => {
  isEditing.value = false;
  // 更新属性
  props.updateAttributes({ latex: latex.value });
  // 重新渲染
  nextTick(renderMath);
};

onMounted(renderMath);

watch(() => props.node.attrs.latex, (newVal) => {
  if (newVal !== latex.value) {
    latex.value = newVal || '';
    nextTick(renderMath);
  }
});

watch(latex, (newVal) => {
  // 实时更新属性
  props.updateAttributes({ latex: newVal });
});
</script>

<style scoped>
/* === 共用 === */
.math-view-wrapper {
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
  position: relative;
  outline: none;
}
.math-view-wrapper:hover {
  background-color: rgba(59, 130, 246, 0.06);
}
.math-view-wrapper:focus {
  background-color: rgba(59, 130, 246, 0.1);
}

.math-placeholder {
  font-size: 0.75rem;
  color: #9ca3af;
  font-style: italic;
}

/* === Inline 模式 === */
.math-view-inline {
  display: inline-block;
  vertical-align: baseline;
  margin: 0 2px;
  padding: 0 4px;
}

/* === Block 模式 === */
.math-view-block {
  display: block;
  margin: 1em 0;
  text-align: center;
  padding: 0.75em 1em;
}
.math-view-block.is-editing {
  text-align: left;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

/* === 渲染失败时的回退样式 === */
.math-fallback {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  color: #dc2626;
  background: #fef2f2;
  padding: 2px 6px;
  border-radius: 4px;
}
.math-view-block .math-fallback {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}
.math-fallback-code {
  color: #991b1b;
  word-break: break-all;
}
.math-error-badge {
  font-size: 0.65rem;
  background: #fecaca;
  color: #991b1b;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
}

/* === 源码区 === */
.math-source {
  display: inline-flex;
  align-items: baseline;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  color: #6d28d9;
  line-height: 1.6;
}
.math-view-block .math-source {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.math-delimiter {
  color: #a78bfa;
  font-weight: 600;
  user-select: none;
  flex-shrink: 0;
}

/* === 输入框 === */
.math-source-input {
  font-family: inherit;
  font-size: inherit;
  color: #4c1d95;
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  line-height: inherit;
}

.math-source-inline-input {
  width: auto;
}

.math-source-textarea {
  display: block;
  width: 100%;
  resize: none;
  overflow: hidden;
  min-height: 1.6em;
  padding: 4px 0;
}
</style>