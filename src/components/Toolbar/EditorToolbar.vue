<template>
  <!-- macOS 上完全隐藏工具栏，使用原生菜单 -->
  <div 
    v-if="!isMac" 
    class="h-10 border-b flex items-center px-4 shadow-sm select-none z-10 transition-colors"
    style="background-color: var(--bg-color); border-color: var(--border-color);"
  >
    <div class="flex items-center space-x-2">
      <button @click="$emit('new-file')" class="px-3 py-1 text-sm hover:bg-gray-100 rounded text-gray-600 font-medium">新建</button>
      <button @click="$emit('open-file')" class="px-3 py-1 text-sm hover:bg-gray-100 rounded text-gray-600 font-medium">打开</button>
      <button @click="$emit('save-file')" class="px-3 py-1 text-sm hover:bg-gray-100 rounded text-gray-600 font-medium">保存</button>
      <div class="mx-1 h-4 w-px bg-gray-200"></div>

      <button 
        @click="$emit('toggle-source')" 
        class="flex items-center space-x-1 px-3 py-1 text-sm rounded border transition-colors"
        :class="isSourceMode ? 'bg-blue-500 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'"
        title="切换源码模式 (Cmd+/)"
      >
        <span class="font-mono">&lt;/&gt;</span>
        <span>源码</span>
      </button>
    </div>

    <div class="flex-1"></div>

    <div class="flex items-center space-x-2 text-[10px] text-gray-400 font-mono">
      <span class="truncate max-w-[300px]">{{ fileStore.currentFile.path || '未命名文档' }}</span>
      <span v-if="fileStore.currentFile.isDirty" class="w-2 h-2 rounded-full bg-orange-400" title="有未保存的更改"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFileStore } from '../../stores/file';
import { isMac as isMacPlatform } from '../../utils/platform';

const fileStore = useFileStore();

const isMac = isMacPlatform;

defineProps<{ isSourceMode: boolean; }>();
defineEmits<{
  (e: 'new-file'): void;
  (e: 'open-file'): void;
  (e: 'save-file'): void;
  (e: 'toggle-sidebar'): void;
  (e: 'toggle-source'): void;
  (e: 'copy-wechat'): void;
}>();
</script>
