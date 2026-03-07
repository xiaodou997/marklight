<template>
  <div
    class="math-view-wrapper"
    :class="[
      isBlock ? 'math-view-block' : 'math-view-inline',
      isEditing ? 'is-editing' : '',
    ]"
    tabindex="0"
    @click.stop="startEditing()"
    @keydown="handleKeyDown"
    @mouseenter="showPreview"
    @mouseleave="hidePreview"
  >
    <!-- 渲染模式 -->
    <div v-show="!isEditing" ref="renderRef" class="math-render"></div>
    <span v-if="!latex && !isEditing" class="math-placeholder">空公式</span>

    <!-- 预览气泡 -->
    <div
      v-if="showPreviewBubble && !isEditing && latex"
      ref="previewRef"
      class="math-preview-bubble"
      :class="{ 'math-preview-bubble-visible': previewReady }"
    >
      <div class="math-preview-content" v-html="previewHtml"></div>
      <div class="math-preview-source">{{ latex }}</div>
    </div>

    <!-- 编辑模式：Typora 风格源码展示 -->
    <div v-if="isEditing" class="math-source" @click.stop>
      <span class="math-delimiter">{{ isBlock ? '$$' : '$' }}</span>
      <textarea
        v-if="isBlock"
        ref="inputRef"
        v-model="latex"
        class="math-source-input math-source-textarea"
        spellcheck="false"
        @blur="stopEditing"
        @keydown.esc="stopEditing"
        @input="autoResize"
      ></textarea>
      <input
        v-else
        ref="inputRef"
        v-model="latex"
        class="math-source-input math-source-inline-input"
        spellcheck="false"
        :size="Math.max(latex.length, 1)"
        @blur="stopEditing"
        @keydown.enter.prevent="stopEditing"
        @keydown.esc="stopEditing"
      />
      <span class="math-delimiter">{{ isBlock ? '$$' : '$' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: any) => void;
}>();

const isBlock = computed(() => props.node.type.name === 'math_block');
const isEditing = ref(false);
const latex = ref(props.node.attrs.latex || '');
const renderRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | HTMLInputElement | null>(null);

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Backspace' && !isEditing.value) {
    e.preventDefault();
    startEditing(true);
  }
};

// 预览气泡状态
const showPreviewBubble = ref(false);
const previewReady = ref(false);
const previewHtml = ref('');

const renderMath = () => {
  if (renderRef.value && latex.value) {
    try {
      katex.render(latex.value, renderRef.value, {
        throwOnError: false,
        displayMode: isBlock.value,
      });
    } catch (e) {
      console.error(e);
    }
  }
};

const renderPreview = () => {
  if (latex.value) {
    try {
      previewHtml.value = katex.renderToString(latex.value, {
        throwOnError: false,
        displayMode: true, // 预览始终用块级模式
      });
    } catch (e) {
      previewHtml.value = '<span style="color: red;">渲染错误</span>';
    }
  }
};

const autoResize = () => {
  const el = inputRef.value;
  if (el && el instanceof HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
};

const startEditing = (isFromBackspace = false) => {
  if (isFromBackspace && latex.value.length > 0) {
    latex.value = latex.value.slice(0, -1);
    props.updateAttributes({ latex: latex.value });
  }
  isEditing.value = true;
  showPreviewBubble.value = false;
  nextTick(() => {
    const el = inputRef.value;
    if (el) {
      el.focus();
      // Place cursor at end
      const len = latex.value.length;
      el.setSelectionRange(len, len);
      if (el instanceof HTMLTextAreaElement) {
        autoResize();
      }
    }
  });
};

const stopEditing = () => {
  isEditing.value = false;
  nextTick(renderMath);
};

const showPreview = () => {
  if (isEditing.value || !latex.value) return;
  
  showPreviewBubble.value = true;
  renderPreview();
  
  nextTick(() => {
    // 延迟显示动画
    setTimeout(() => {
      previewReady.value = true;
    }, 10);
  });
};

const hidePreview = () => {
  previewReady.value = false;
  // 延迟隐藏，让动画完成
  setTimeout(() => {
    showPreviewBubble.value = false;
  }, 150);
};

onMounted(renderMath);

watch(() => props.node.attrs.latex, (newVal) => {
  if (newVal !== latex.value) {
    latex.value = newVal;
    nextTick(renderMath);
  }
});

watch(latex, (newVal) => {
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
}
.math-view-wrapper:hover {
  background-color: rgba(59, 130, 246, 0.06);
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
  padding: 0 2px;
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

/* === 预览气泡 === */
.math-preview-bubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%) translateY(4px);
  z-index: 100;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 12px 16px;
  min-width: 120px;
  max-width: 400px;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}
.math-preview-bubble-visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.math-preview-content {
  text-align: center;
  font-size: 1.1em;
  overflow-x: auto;
}

.math-preview-source {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
  word-break: break-all;
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