<template>
  <div
    v-show="visible"
    class="search-bar fixed top-14 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-3 z-50 w-80"
  >
    <!-- 搜索输入行 -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <input
          ref="searchInputRef"
          v-model="query"
          type="text"
          placeholder="搜索..."
          class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          @input="onQueryChange"
          @keydown.enter.prevent="onFindNext"
          @keydown.shift.enter.prevent="onFindPrev"
          @keydown.esc="onClose"
        />
      </div>
      
      <!-- 匹配计数 -->
      <span class="text-xs text-gray-500 dark:text-gray-400 min-w-[3rem] text-center">
        {{ matchText }}
      </span>
      
      <!-- 上一个/下一个 -->
      <button
        @click="onFindPrev"
        class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        title="上一个 (Shift+Enter)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        @click="onFindNext"
        class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        title="下一个 (Enter)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <!-- 大小写敏感 -->
      <button
        @click="toggleCaseSensitive"
        :class="[
          'p-1.5 rounded font-medium text-xs',
          caseSensitive
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
        ]"
        title="区分大小写"
      >
        Aa
      </button>
      
      <!-- 关闭 -->
      <button
        @click="onClose"
        class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        title="关闭 (Esc)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <!-- 替换输入行 -->
    <div v-if="showReplace" class="flex items-center gap-2 mt-2">
      <input
        ref="replaceInputRef"
        v-model="replacement"
        type="text"
        placeholder="替换为..."
        class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        @keydown.enter.prevent="onReplace"
      />
      <button
        @click="onReplace"
        class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        title="替换当前"
      >
        替换
      </button>
      <button
        @click="onReplaceAll"
        class="px-3 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
        title="全部替换"
      >
        全部
      </button>
    </div>
    
    <!-- 切换替换模式 -->
    <button
      v-if="!showReplace"
      @click="toggleReplace"
      class="mt-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
    >
      显示替换
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  matchCount: number;
  currentIndex: number;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'query', value: string): void;
  (e: 'caseSensitive', value: boolean): void;
  (e: 'next'): void;
  (e: 'prev'): void;
  (e: 'replace', value: string): void;
  (e: 'replaceAll', value: string): void;
  (e: 'close'): void;
}>();

const searchInputRef = ref<HTMLInputElement | null>(null);
const replaceInputRef = ref<HTMLInputElement | null>(null);
const query = ref('');
const replacement = ref('');
const caseSensitive = ref(false);
const showReplace = ref(false);

const matchText = computed(() => {
  if (!query.value) return '0/0';
  if (props.matchCount === 0) return '无匹配';
  return `${props.currentIndex + 1}/${props.matchCount}`;
});

// 当可见性变化时聚焦输入框
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  } else {
    // 关闭时清空
    query.value = '';
    replacement.value = '';
  }
});

function onQueryChange() {
  emit('query', query.value);
}

function onFindNext() {
  if (props.matchCount > 0) {
    emit('next');
  }
}

function onFindPrev() {
  if (props.matchCount > 0) {
    emit('prev');
  }
}

function toggleCaseSensitive() {
  caseSensitive.value = !caseSensitive.value;
  emit('caseSensitive', caseSensitive.value);
}

function toggleReplace() {
  showReplace.value = true;
  nextTick(() => {
    replaceInputRef.value?.focus();
  });
}

function onReplace() {
  if (props.matchCount > 0 && replacement.value !== undefined) {
    emit('replace', replacement.value);
  }
}

function onReplaceAll() {
  if (props.matchCount > 0 && replacement.value !== undefined) {
    emit('replaceAll', replacement.value);
  }
}

function onClose() {
  emit('close');
}

// 暴露方法供父组件调用
defineExpose({
  setShowReplace: (value: boolean) => {
    showReplace.value = value;
  }
});
</script>

<style scoped>
.search-match {
  background-color: #fef08a;
}

:global(.dark) .search-match {
  background-color: #854d0e;
}

.search-match-current {
  background-color: #fbbf24;
  box-shadow: 0 0 0 2px #f59e0b;
}

:global(.dark) .search-match-current {
  background-color: #fbbf24;
  box-shadow: 0 0 0 2px #f59e0b;
}
</style>
