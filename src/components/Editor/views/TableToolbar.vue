<template>
  <div 
    v-show="visible"
    ref="toolbarRef"
    class="fixed z-50 flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-lg transition-all duration-200"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px`, transform: 'translate(-50%, -120%)' }"
  >
    <!-- 行操作 -->
    <div class="flex items-center gap-0.5 border-r border-gray-100 pr-1 mr-1">
      <button @click="exec('addRowBefore')" class="p-1 hover:bg-gray-100 rounded text-gray-600" title="在上方插入行">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button @click="exec('addRowAfter')" class="p-1 hover:bg-gray-100 rounded text-gray-600" title="在下方插入行">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <button @click="exec('deleteRow')" class="p-1 hover:bg-red-50 hover:text-red-500 rounded" title="删除当前行">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
      </button>
    </div>

    <!-- 列操作 -->
    <div class="flex items-center gap-0.5 border-r border-gray-100 pr-1 mr-1">
      <button @click="exec('addColumnBefore')" class="p-1 hover:bg-gray-100 rounded text-gray-600" title="在左侧插入列">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button @click="exec('addColumnAfter')" class="p-1 hover:bg-gray-100 rounded text-gray-600" title="在右侧插入列">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <button @click="exec('deleteColumn')" class="p-1 hover:bg-red-50 hover:text-red-500 rounded" title="删除当前列">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20V4" />
        </svg>
      </button>
    </div>

    <!-- 删除整个表格 -->
    <button @click="exec('deleteTable')" class="p-1 hover:bg-red-500 hover:text-white rounded transition-colors" title="删除整个表格">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
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
