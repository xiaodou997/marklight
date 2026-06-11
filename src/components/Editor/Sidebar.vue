<template>
  <div
    class="sidebar-container h-full flex flex-col select-none border-r"
    style="background-color: var(--sidebar-bg); border-color: var(--border-color)"
  >
    <!-- 标签切换 -->
    <div class="flex border-b" style="border-color: var(--border-color)">
      <button
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="
          mode === 'outline'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        "
        @click="$emit('update:mode', 'outline')"
      >
        大纲
      </button>
      <button
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="
          mode === 'files'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        "
        @click="$emit('update:mode', 'files')"
      >
        文件
      </button>
    </div>

    <!-- 大纲模式 -->
    <SidebarOutlinePanel
      v-if="mode === 'outline'"
      :items="outlineItems"
      @scroll-to="$emit('scroll-to', $event)"
    />

    <SidebarFilesPanel
      v-else
      :root-folder="rootFolder"
      :root-folder-name="rootFolderName"
      :search-query="searchQuery"
      :search-results="searchResults"
      :flat-tree="flatTree"
      :current-file-path="currentFilePath"
      @update-search-query="searchQuery = $event"
      @open-folder="$emit('open-folder')"
      @select-node="handleNodeClick"
      @context-menu="showContextMenu"
      @new-menu="showNewMenu"
    />

    <SidebarMenus
      :context-menu="contextMenu"
      :new-menu="newMenu"
      @rename="handleRename"
      @reveal="handleRevealInFinder"
      @delete="handleDelete"
      @new-file="handleNewFile"
      @new-folder="handleNewFolder"
    />

    <SidebarFileDialogs
      :rename-dialog="renameDialog"
      :new-dialog="newDialog"
      @close-rename="renameDialog.visible = false"
      @update-rename-name="renameDialog.newName = $event"
      @confirm-rename="confirmRename"
      @close-new="newDialog.visible = false"
      @update-new-name="newDialog.name = $event"
      @confirm-new="confirmNew"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import type { TreeNode } from '../../composables/useWorkspaceSession';
import { confirm } from '../../services/tauri/dialog';
import SidebarFileDialogs from './SidebarFileDialogs.vue';
import SidebarFilesPanel from './SidebarFilesPanel.vue';
import SidebarMenus from './SidebarMenus.vue';
import SidebarOutlinePanel, { type SidebarOutlineItem } from './SidebarOutlinePanel.vue';

export type OutlineItem = SidebarOutlineItem;

const props = defineProps<{
  mode: 'outline' | 'files';
  outlineItems: OutlineItem[];
  treeNodes: TreeNode[];
  rootFolder: string | null;
  currentFilePath: string | null;
  pendingRenamePath?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:mode', mode: 'outline' | 'files'): void;
  (e: 'scroll-to', pos: number): void;
  (e: 'open-folder'): void;
  (e: 'open-file', path: string): void;
  (e: 'open-image', path: string): void;
  (e: 'open-file-in-new-window', path: string): void;
  (e: 'toggle-dir', path: string): void;
  (e: 'refresh-files'): void;
  (e: 'file-renamed', oldPath: string, newName: string): void;
  (e: 'file-deleted', path: string): void;
  (e: 'file-created', name: string, isFolder: boolean): void;
  (e: 'reveal-in-finder', path: string): void;
  (e: 'rename-completed'): void;
}>();

const searchQuery = ref('');

// ── 树扁平化 ──────────────────────────────────────────────────

function flatten(nodes: TreeNode[], depth = 0): Array<{ node: TreeNode; depth: number }> {
  const result: Array<{ node: TreeNode; depth: number }> = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.is_dir && node.expanded && node.children) {
      result.push(...flatten(node.children, depth + 1));
    }
  }
  return result;
}

function collectAll(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.is_dir && node.children) result.push(...collectAll(node.children));
  }
  return result;
}

const flatTree = computed(() => flatten(props.treeNodes));

const searchResults = computed(() => {
  if (!searchQuery.value) return [];
  const q = searchQuery.value.toLowerCase();
  return collectAll(props.treeNodes).filter((n) => n.name.toLowerCase().includes(q));
});

const rootFolderName = computed(() => {
  if (!props.rootFolder) return '';
  const parts = props.rootFolder.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? props.rootFolder;
});

// ── 右键菜单 ──────────────────────────────────────────────────

const contextMenu = ref<{ visible: boolean; x: number; y: number; node: TreeNode | null }>({
  visible: false,
  x: 0,
  y: 0,
  node: null,
});

const newMenu = ref<{ visible: boolean; x: number; y: number }>({
  visible: false,
  x: 0,
  y: 0,
});

const renameDialog = ref<{ visible: boolean; newName: string }>({
  visible: false,
  newName: '',
});

const newDialog = ref<{ visible: boolean; name: string; isFolder: boolean }>({
  visible: false,
  name: '',
  isFolder: false,
});

function showContextMenu(event: MouseEvent, node: TreeNode) {
  contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, node };
}

function showNewMenu(event?: MouseEvent) {
  const btn = (event?.target ?? (window.event as MouseEvent)?.target) as HTMLElement | null;
  const rect = btn?.getBoundingClientRect();
  newMenu.value = {
    visible: true,
    x: rect ? rect.left : 0,
    y: rect ? rect.bottom + 4 : 0,
  };
}

// ── 节点点击 ──────────────────────────────────────────────────

function handleNodeClick(node: TreeNode, event?: MouseEvent) {
  if (node.is_image) {
    emit('open-image', node.path);
    return;
  }
  if (node.is_dir) {
    emit('toggle-dir', node.path);
    return;
  }
  if (event && (event.metaKey || event.ctrlKey)) {
    emit('open-file-in-new-window', node.path);
    return;
  }
  emit('open-file', node.path);
}

// ── 重命名 ───────────────────────────────────────────────────

function handleRename() {
  if (!contextMenu.value.node) return;
  renameDialog.value.newName = contextMenu.value.node.name;
  renameDialog.value.visible = true;
  contextMenu.value.visible = false;
}

function confirmRename() {
  if (!contextMenu.value.node || !renameDialog.value.newName.trim()) return;
  emit('file-renamed', contextMenu.value.node.path, renameDialog.value.newName.trim());
  renameDialog.value.visible = false;
  emit('rename-completed');
}

// ── 删除 ─────────────────────────────────────────────────────

async function handleDelete() {
  if (!contextMenu.value.node) return;
  const node = contextMenu.value.node;
  const msg = node.is_dir
    ? `确定删除文件夹 "${node.name}" 及其所有内容？`
    : `确定删除文件 "${node.name}"？`;
  const confirmed = await confirm(msg, {
    title: '删除确认',
    kind: 'warning',
    okLabel: '删除',
    cancelLabel: '取消',
  });
  if (confirmed) emit('file-deleted', node.path);
  contextMenu.value.visible = false;
}

function handleRevealInFinder() {
  if (!contextMenu.value.node) return;
  emit('reveal-in-finder', contextMenu.value.node.path);
  contextMenu.value.visible = false;
}

// ── 新建 ─────────────────────────────────────────────────────

function handleNewFile() {
  newMenu.value.visible = false;
  emit('file-created', '__AUTO_RENAME__', false);
}

function handleNewFolder() {
  newDialog.value = { visible: true, name: '', isFolder: true };
  newMenu.value.visible = false;
}

function confirmNew() {
  if (!newDialog.value.name.trim()) return;
  emit('file-created', newDialog.value.name.trim(), newDialog.value.isFolder);
  newDialog.value.visible = false;
}

// ── pendingRenamePath 监听 ────────────────────────────────────

watch(
  () => props.pendingRenamePath,
  (path) => {
    if (!path) return;
    const node = collectAll(props.treeNodes).find((n) => n.path === path);
    if (node) {
      nextTick(() => {
        contextMenu.value.node = node;
        renameDialog.value.newName = node.name.replace(/\.md$/i, '');
        renameDialog.value.visible = true;
      });
    }
  },
);

// ── 点击外部关闭菜单 ──────────────────────────────────────────

function handleClickOutside() {
  contextMenu.value.visible = false;
  newMenu.value.visible = false;
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>
