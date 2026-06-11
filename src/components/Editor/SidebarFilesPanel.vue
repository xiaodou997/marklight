<script setup lang="ts">
import type { TreeNode } from '../../composables/useWorkspaceSession';
import FileTreePanel from './FileTreePanel.vue';
import FileTreeSearchResults from './FileTreeSearchResults.vue';

defineProps<{
  rootFolder: string | null;
  rootFolderName: string;
  searchQuery: string;
  searchResults: TreeNode[];
  flatTree: Array<{ node: TreeNode; depth: number }>;
  currentFilePath: string | null;
}>();

const emit = defineEmits<{
  (e: 'update-search-query', value: string): void;
  (e: 'open-folder'): void;
  (e: 'select-node', node: TreeNode, event?: MouseEvent): void;
  (e: 'context-menu', event: MouseEvent, node: TreeNode): void;
  (e: 'new-menu', event: MouseEvent): void;
}>();
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div v-if="!rootFolder" class="flex-1 p-4 text-xs text-gray-400 italic">
      请打开文件夹以查看文件列表
      <button class="block mt-2 text-blue-500 hover:underline" @click="emit('open-folder')">
        打开文件夹
      </button>
    </div>
    <template v-else>
      <div class="flex-shrink-0 px-3 py-2 border-b" style="border-color: var(--border-color)">
        <input
          :value="searchQuery"
          type="text"
          placeholder="搜索文件..."
          class="w-full px-2 py-1 text-xs rounded focus:outline-none"
          style="
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            color: var(--text-color);
          "
          @input="emit('update-search-query', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="flex-1 overflow-y-auto py-1">
        <FileTreeSearchResults
          v-if="searchQuery"
          :nodes="searchResults"
          :current-file-path="currentFilePath"
          @select="(node, event) => emit('select-node', node, event)"
          @context-menu="(event, node) => emit('context-menu', event, node)"
        />

        <FileTreePanel
          v-else
          :items="flatTree"
          :current-file-path="currentFilePath"
          @select="(node, event) => emit('select-node', node, event)"
          @context-menu="(event, node) => emit('context-menu', event, node)"
        />
      </div>
    </template>

    <div
      v-if="rootFolder"
      class="flex-shrink-0 border-t px-2 py-1.5"
      style="border-color: var(--border-color); background: var(--sidebar-bg)"
    >
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-gray-400 truncate flex-1">{{ rootFolderName }}</span>
        <button
          class="ml-2 flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
          title="新建"
          @click="emit('new-menu', $event)"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
