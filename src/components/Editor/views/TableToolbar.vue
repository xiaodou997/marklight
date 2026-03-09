<template>
  <div 
    v-show="visible"
    ref="toolbarRef"
    class="fixed z-50 flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 shadow-lg backdrop-blur-sm transition-all duration-200"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px`, transform: 'translate(-50%, -120%)' }"
  >
    <!-- 行操作 -->
    <div class="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2 mr-1">
      <button @click="exec('addRowBefore')" class="toolbar-btn" title="快捷键: Cmd+↑">
        <div class="flex flex-col items-center gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
          <span class="text-[10px] leading-none">上插行</span>
        </div>
      </button>
      <button @click="exec('addRowAfter')" class="toolbar-btn" title="快捷键: Cmd+↓">
        <div class="flex flex-col items-center gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
          <span class="text-[10px] leading-none">下插行</span>
        </div>
      </button>
      <button @click="exec('deleteRow')" class="toolbar-btn danger" title="删除当前行">
        <div class="flex flex-col items-center gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
          <span class="text-[10px] leading-none">删行</span>
        </div>
      </button>
    </div>

    <!-- 列操作 -->
    <div class="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2 mr-1">
      <button @click="exec('addColumnBefore')" class="toolbar-btn" title="快捷键: Cmd+←">
        <div class="flex flex-col items-center gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="text-[10px] leading-none">左插列</span>
        </div>
      </button>
      <button @click="exec('addColumnAfter')" class="toolbar-btn" title="快捷键: Cmd+→">
        <div class="flex flex-col items-center gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="text-[10px] leading-none">右插列</span>
        </div>
      </button>
      <button @click="exec('deleteColumn')" class="toolbar-btn danger" title="删除当前列">
        <div class="flex flex-col items-center gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20V4" />
          </svg>
          <span class="text-[10px] leading-none">删列</span>
        </div>
      </button>
    </div>

    <!-- 删除整个表格 -->
    <button @click="exec('deleteTable')" class="toolbar-btn danger-full" title="删除整个表格">
      <div class="flex flex-col items-center gap-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span class="text-[10px] leading-none">删表</span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const emit = defineEmits<{
  (e: 'action', type: string): void;
}>();

const visible = ref(false);
const pos = reactive({ left: 0, top: 0 });

const exec = (type: string) => {
  emit('action', type);
};

defineExpose({
  update(show: boolean, left: number, top: number) {
    visible.value = show;
    pos.left = left;
    pos.top = top;
  }
});
</script>

<style scoped>
.toolbar-btn {
  padding: 4px 6px;
  border-radius: 6px;
  color: #4b5563;
  transition: all 0.15s ease;
}

.dark .toolbar-btn {
  color: #9ca3af;
}

.toolbar-btn:hover {
  background-color: #f3f4f6;
}

.dark .toolbar-btn:hover {
  background-color: #374151;
}

.toolbar-btn.danger:hover {
  background-color: #fef2f2;
  color: #ef4444;
}

.dark .toolbar-btn.danger:hover {
  background-color: rgba(127, 29, 29, 0.3);
  color: #f87171;
}

.toolbar-btn.danger-full {
  padding: 4px 6px;
  border-radius: 6px;
  color: #4b5563;
  transition: all 0.15s ease;
}

.dark .toolbar-btn.danger-full {
  color: #9ca3af;
}

.toolbar-btn.danger-full:hover {
  background-color: #ef4444;
  color: white;
}

.dark .toolbar-btn.danger-full:hover {
  background-color: #dc2626;
}
</style>
