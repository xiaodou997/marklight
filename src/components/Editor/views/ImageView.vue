<template>
  <div
    class="image-view-wrapper"
    :class="{ 'is-editing': isEditing }"
    @click.stop="startEditing"
  >
    <!-- 编辑模式：图片上方显示源码 -->
    <div v-if="isEditing" class="image-source" @click.stop>
      <span class="image-source-marker">![</span>
      <input
        v-model="altText"
        class="image-source-input image-source-alt"
        placeholder="alt"
        spellcheck="false"
        :size="Math.max(altText.length, 3)"
        @keydown.esc="stopEditing"
      />
      <span class="image-source-marker">](</span>
      <input
        ref="srcRef"
        v-model="srcText"
        class="image-source-input image-source-src"
        placeholder="url"
        spellcheck="false"
        @blur="onBlur"
        @keydown.enter.prevent="stopEditing"
        @keydown.esc="stopEditing"
      />
      <span class="image-source-marker">)</span>
    </div>

    <!-- 图片展示 -->
    <div class="image-display">
      <img
        v-if="!error"
        :src="safeSrc"
        :alt="node.attrs.alt"
        class="image-el"
        @error="handleError"
      />
      <div v-if="error" class="image-error">
        <span class="text-xl">🖼️</span>
        <p>图片无法加载</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: any) => void;
}>();

const error = ref(false);
const isEditing = ref(false);
const altText = ref('');
const srcText = ref('');
const srcRef = ref<HTMLInputElement | null>(null);

const safeSrc = computed(() => {
  const src = props.node?.attrs?.src;
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('data:')) return src;
  if (src.startsWith('/') || src.includes(':\\')) {
    try {
      return convertFileSrc(src);
    } catch (e) {
      console.warn('Path conversion failed:', e);
      return src;
    }
  }
  return src;
});

const handleError = () => {
  error.value = true;
};

const startEditing = () => {
  altText.value = props.node.attrs.alt || '';
  srcText.value = props.node.attrs.src || '';
  isEditing.value = true;
  nextTick(() => {
    srcRef.value?.focus();
  });
};

const stopEditing = () => {
  if (!isEditing.value) return;
  // 将修改写回节点
  const newAlt = altText.value;
  const newSrc = srcText.value;
  if (newAlt !== (props.node.attrs.alt || '') || newSrc !== (props.node.attrs.src || '')) {
    props.updateAttributes({ alt: newAlt, src: newSrc });
    error.value = false;
  }
  isEditing.value = false;
};

const onBlur = () => {
  setTimeout(stopEditing, 150);
};
</script>

<style scoped>
.image-view-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
  margin: 1em 0;
  cursor: pointer;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}
.image-view-wrapper:hover {
  border-color: #bfdbfe;
}
.image-view-wrapper.is-editing {
  border-color: #93c5fd;
  cursor: default;
}

/* 图片 */
.image-display {
  overflow: hidden;
  border-radius: 0.5rem;
}
.image-el {
  display: block;
  height: auto;
  max-width: 100%;
  background: #f9fafb;
  min-width: 32px;
  min-height: 32px;
}
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 16rem;
  height: 8rem;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 0.25rem;
  color: #9ca3af;
  font-size: 0.625rem;
}

/* 源码区 */
.image-source {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  border-radius: 0.5rem 0.5rem 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  overflow-x: auto;
}

.image-source-marker {
  color: #a78bfa;
  font-weight: 600;
  user-select: none;
  flex-shrink: 0;
}

.image-source-input {
  font-family: inherit;
  font-size: inherit;
  color: #4c1d95;
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  line-height: inherit;
  min-width: 2em;
}
.image-source-alt {
  max-width: 10em;
}
.image-source-src {
  flex: 1;
  min-width: 8em;
}
</style>
