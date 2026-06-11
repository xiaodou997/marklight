<script setup lang="ts">
import type { CommandPaletteFile } from './command-palette-types';

const props = defineProps<{
  files: CommandPaletteFile[];
  selectedIndex: number;
  searchQuery: string;
  hasWorkspaceFiles: boolean;
  currentFolder?: string | null;
}>();

const emit = defineEmits<{
  (e: 'open', file: CommandPaletteFile): void;
  (e: 'select', index: number): void;
}>();

function getRelativePath(path: string) {
  if (!props.currentFolder) return path;
  return path.replace(props.currentFolder, '~');
}
</script>

<template>
  <div class="command-list">
    <div v-if="files.length > 0" class="command-list-header">文件</div>
    <div
      v-for="(file, index) in files"
      :key="file.path"
      class="command-item"
      :class="{ 'command-item-selected': index === selectedIndex }"
      @click="emit('open', file)"
      @mouseenter="emit('select', index)"
    >
      <div class="command-item-icon">
        <template v-if="file.is_dir">📁</template>
        <template v-else-if="file.is_md">📝</template>
        <template v-else>📄</template>
      </div>
      <div class="command-item-content">
        <div class="command-item-title">{{ file.name }}</div>
        <div class="command-item-path">{{ getRelativePath(file.path) }}</div>
      </div>
    </div>
    <div v-if="files.length === 0 && searchQuery" class="command-empty">没有找到匹配的文件</div>
    <div v-if="files.length === 0 && !searchQuery && !hasWorkspaceFiles" class="command-empty">
      请先打开文件夹
    </div>
    <div v-if="files.length === 0 && !searchQuery && hasWorkspaceFiles" class="command-empty">
      输入关键词搜索文件
    </div>
  </div>
</template>

<style scoped>
.command-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.command-list-header {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 12px;
  margin-bottom: 4px;
}

.command-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.1s;
}

.command-item:hover,
.command-item-selected {
  background: rgba(0, 0, 0, 0.05);
}

.dark .command-item:hover,
.dark .command-item-selected {
  background: rgba(255, 255, 255, 0.1);
}

.command-item-icon {
  font-size: 18px;
  width: 28px;
  text-align: center;
  margin-right: 12px;
}

.command-item-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.command-item-title {
  font-size: 14px;
  color: inherit;
}

.command-item-path {
  font-size: 12px;
  color: #9ca3af;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.command-empty {
  padding: 24px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}
</style>
