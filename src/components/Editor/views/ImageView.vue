<template>
  <div
    class="image-view-wrapper"
    :class="{ 'is-editing': isEditing }"
    @click.stop="handleClick"
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
      <!-- 加载中状态 -->
      <div v-if="isLoading" class="image-loading">
        <div class="loading-spinner"></div>
        <span class="loading-text">加载中...</span>
      </div>
      
      <!-- 图片 -->
      <img
        v-else-if="!error && loadedSrc"
        :src="loadedSrc"
        :alt="node.attrs.alt"
        class="image-el"
        @error="handleError"
        @load="handleLoad"
      />
      
      <!-- 错误状态 -->
      <div v-else-if="error" class="image-error">
        <span class="text-xl">🖼️</span>
        <p>图片无法加载</p>
        <p class="error-path" :title="node?.attrs?.src">{{ truncatePath(node?.attrs?.src) }}</p>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <Teleport to="body">
      <Transition name="preview-fade">
        <div
          v-if="showPreview"
          class="image-preview-overlay"
          @click="closePreview"
          @keydown.esc="closePreview"
        >
          <div class="image-preview-container">
            <img
              :src="loadedSrc"
              :alt="node.attrs.alt"
              class="preview-image"
              @click.stop
            />
            <button class="preview-close" @click="closePreview">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div v-if="node.attrs.alt" class="preview-caption">{{ node.attrs.alt }}</div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../../stores/file';

// 图片缓存
const imageCache = new Map<string, string>();

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: any) => void;
}>();

const fileStore = useFileStore();
const error = ref(false);
const isLoading = ref(false);
const loadedSrc = ref('');
const isEditing = ref(false);
const showPreview = ref(false);
const altText = ref('');
const srcText = ref('');
const srcRef = ref<HTMLInputElement | null>(null);

/**
 * 规范化路径分隔符
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * 获取目录路径
 */
function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash !== -1 ? normalized.substring(0, lastSlash) : normalized;
}

/**
 * 拼接路径
 */
function joinPath(dir: string, relativePath: string): string {
  const normalizedDir = normalizePath(dir);
  const normalizedRelative = normalizePath(relativePath);
  return `${normalizedDir}/${normalizedRelative}`;
}

const truncatePath = (path: string | undefined): string => {
  if (!path) return '';
  if (path.length <= 50) return path;
  return '...' + path.slice(-47);
};

/**
 * 加载图片
 */
async function loadImage(src: string) {
  if (!src) return;
  
  // 检查缓存
  if (imageCache.has(src)) {
    loadedSrc.value = imageCache.get(src)!;
    return;
  }
  
  // 网络图片 - 异步加载
  if (src.startsWith('http://') || src.startsWith('https://')) {
    isLoading.value = true;
    error.value = false;
    
    try {
      const dataUrl = await invoke<string>('fetch_remote_image', { url: src });
      loadedSrc.value = dataUrl;
      imageCache.set(src, dataUrl);
    } catch (e) {
      console.error('[ImageView] Failed to load remote image:', e);
      error.value = true;
    } finally {
      isLoading.value = false;
    }
    return;
  }
  
  // data URL 直接使用
  if (src.startsWith('data:')) {
    loadedSrc.value = src;
    return;
  }
  
  // 本地文件路径
  let localSrc = src;
  
  // 绝对路径
  if (src.startsWith('/') || /^[a-zA-Z]:/.test(src)) {
    localSrc = normalizePath(src);
    try {
      loadedSrc.value = convertFileSrc(localSrc);
    } catch (e) {
      console.warn('[ImageView] Path conversion failed:', e);
      loadedSrc.value = src;
    }
    return;
  }
  
  // 相对路径
  if (fileStore.currentFile.path) {
    const dir = getDirectory(fileStore.currentFile.path);
    const absolutePath = joinPath(dir, src);
    try {
      loadedSrc.value = convertFileSrc(absolutePath);
    } catch (e) {
      console.warn('[ImageView] Relative path conversion failed:', e);
      loadedSrc.value = src;
    }
  }
}

// 监听 src 变化
watch(
  () => props.node?.attrs?.src,
  (newSrc) => {
    if (newSrc) {
      loadImage(newSrc);
    }
  },
  { immediate: true }
);

const handleError = () => {
  error.value = true;
  isLoading.value = false;
};

const handleLoad = () => {
  error.value = false;
  isLoading.value = false;
};

const handleClick = () => {
  if (isLoading.value) return;
  
  if (error.value) {
    startEditing();
  } else {
    showPreview.value = true;
  }
};

const closePreview = () => {
  showPreview.value = false;
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
  const newAlt = altText.value;
  const newSrc = srcText.value;
  if (newAlt !== (props.node.attrs.alt || '') || newSrc !== (props.node.attrs.src || '')) {
    props.updateAttributes({ alt: newAlt, src: newSrc });
    error.value = false;
    // 重新加载图片
    loadImage(newSrc);
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
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
}
.image-el {
  display: block;
  height: auto;
  max-width: 100%;
  min-width: 32px;
  min-height: 32px;
}

/* 加载中状态 */
.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #6b7280;
}
.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.loading-text {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

/* 错误状态 */
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
.error-path {
  margin-top: 0.5rem;
  font-size: 0.5rem;
  color: #9ca3af;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-all;
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

/* 图片预览弹窗 */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
}

.image-preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 0.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.preview-close {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}
.preview-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.preview-caption {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  max-width: 80vw;
  text-align: center;
}

/* 预览动画 */
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.2s ease;
}
.preview-fade-enter-active .preview-image,
.preview-fade-leave-active .preview-image {
  transition: transform 0.2s ease;
}
.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
.preview-fade-enter-from .preview-image,
.preview-fade-leave-to .preview-image {
  transform: scale(0.95);
}
</style>
