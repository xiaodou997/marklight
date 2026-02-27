<template>
  <div
    class="math-view-wrapper"
    :class="[
      isBlock ? 'math-view-block' : 'math-view-inline',
      isEditing ? 'is-editing' : '',
    ]"
    @click.stop="startEditing"
  >
    <!-- 渲染模式 -->
    <div v-show="!isEditing" ref="renderRef" class="math-render"></div>
    <span v-if="!latex && !isEditing" class="math-placeholder">空公式</span>

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

const autoResize = () => {
  const el = inputRef.value;
  if (el && el instanceof HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
};

const startEditing = () => {
  isEditing.value = true;
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
