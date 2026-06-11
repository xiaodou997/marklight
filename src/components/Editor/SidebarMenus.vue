<script setup lang="ts">
import { getFileManagerName } from '../../utils/platform';
import type { TreeNode } from '../../composables/useWorkspaceSession';

export interface SidebarContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: TreeNode | null;
}

export interface SidebarNewMenuState {
  visible: boolean;
  x: number;
  y: number;
}

defineProps<{
  contextMenu: SidebarContextMenuState;
  newMenu: SidebarNewMenuState;
}>();

const emit = defineEmits<{
  (e: 'rename'): void;
  (e: 'reveal'): void;
  (e: 'delete'): void;
  (e: 'new-file'): void;
  (e: 'new-folder'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div v-if="contextMenu.node" class="context-menu-items">
        <div class="context-menu-item" @click="emit('rename')">
          <span class="context-menu-icon">✏️</span>
          <span>重命名</span>
        </div>
        <div class="context-menu-item" @click="emit('reveal')">
          <span class="context-menu-icon">📂</span>
          <span>在 {{ getFileManagerName() }} 中显示</span>
        </div>
        <div class="context-menu-item context-menu-item-danger" @click="emit('delete')">
          <span class="context-menu-icon">🗑️</span>
          <span>删除</span>
        </div>
      </div>
    </div>

    <div
      v-if="newMenu.visible"
      class="context-menu"
      :style="{ left: newMenu.x + 'px', top: newMenu.y + 'px' }"
    >
      <div class="context-menu-items">
        <div class="context-menu-item" @click="emit('new-file')">
          <span class="context-menu-icon">📄</span>
          <span>新建文件</span>
        </div>
        <div class="context-menu-item" @click="emit('new-folder')">
          <span class="context-menu-icon">📁</span>
          <span>新建文件夹</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 140px;
  padding: 4px 0;
  color: var(--text-color);
}

.context-menu-items {
  display: flex;
  flex-direction: column;
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.1s;
}

.context-menu-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.dark .context-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.context-menu-item-danger {
  color: #dc2626;
}

.context-menu-item-danger:hover {
  background-color: #fef2f2;
}

.dark .context-menu-item-danger:hover {
  background-color: #450a0a;
}

.context-menu-icon {
  margin-right: 8px;
  font-size: 14px;
}
</style>
