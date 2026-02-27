<template>
  <div class="h-6 bg-gray-50 border-t border-gray-200 flex items-center px-4 text-[11px] text-gray-500 justify-between select-none">
    <div class="flex items-center space-x-4">
      <div class="flex items-center space-x-1">
        <span>行 {{ cursor.line }}, 列 {{ cursor.col }}</span>
      </div>
      <div v-if="selectionText" class="text-blue-500 font-medium">
        已选中 {{ selectionText.length }} 字
      </div>
    </div>

    <div class="flex items-center space-x-4">
      <span>{{ wordCount }} 字</span>
      <span>预计阅读 {{ readingTime }} 分钟</span>
      <div class="flex items-center space-x-1">
        <span :class="fileStore.currentFile.isDirty ? 'text-orange-500' : 'text-green-500'">
          ●
        </span>
        <span>{{ fileStore.currentFile.isDirty ? '未保存' : '已保存' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useFileStore } from '../../stores/file';

const props = defineProps<{
  wordCount: number;
  cursor: { line: number; col: number };
  selectionText: string;
}>();

const fileStore = useFileStore();

const readingTime = computed(() => {
  return Math.max(1, Math.ceil(props.wordCount / 400));
});
</script>
