<template>
  <div
    class="sidebar-container h-full flex flex-col select-none border-r"
    style="background-color: var(--sidebar-bg); border-color: var(--border-color)"
  >
    <!-- 标签切换 -->
    <div class="flex border-b" style="border-color: var(--border-color)">
      <button
        @click="$emit('update:mode', 'outline')"
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="
          mode === 'outline'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        "
      >
        大纲
      </button>
      <button
        @click="$emit('update:mode', 'files')"
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="
          mode === 'files'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        "
      >
        文件
      </button>
    </div>

    <!-- 大纲模式 -->
    <div v-if="mode === 'outline'" class="flex-1 overflow-y-auto p-4">
      <div v-if="outlineItems.length === 0" class="text-xs text-gray-400 px-2 italic">暂无标题</div>
      <nav class="space-y-1">
        <div
          v-for="item in outlineItems"
          :key="item.pos"
          @click="$emit('scroll-to', item.pos)"
          :style="{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }"
          class="group flex items-center py-1.5 px-2 rounded-md text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors"
        >
          <span class="truncate">{{ item.text }}</span>
        </div>
      </nav>
    </div>

    <!-- 文件树模式 -->
    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <div v-if="!rootFolder" class="flex-1 p-4 text-xs text-gray-400 italic">
        请打开文件夹以查看文件列表
        <button @click="$emit('open-folder')" class="block mt-2 text-blue-500 hover:underline">
          打开文件夹
        </button>
      </div>
      <template v-else>
        <!-- 搜索框 -->
        <div class="flex-shrink-0 px-3 py-2 border-b" style="border-color: var(--border-color)">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索文件..."
            class="w-full px-2 py-1 text-xs rounded focus:outline-none"
            style="
              background: var(--bg-color);
              border: 1px solid var(--border-color);
              color: var(--text-color);
            "
          />
        </div>

        <!-- 文件树（可滚动） -->
        <div class="flex-1 overflow-y-auto py-1">
          <!-- 搜索结果：平铺列表 -->
          <template v-if="searchQuery">
            <div v-if="searchResults.length === 0" class="px-4 py-3 text-xs text-gray-400 italic">
              没有匹配的文件
            </div>
            <div
              v-for="node in searchResults"
              :key="node.path"
              @click="handleNodeClick(node, $event)"
              @contextmenu.prevent="showContextMenu($event, node)"
              class="flex items-center py-1 px-2 text-sm cursor-pointer transition-colors truncate"
              :class="
                node.path === currentFilePath
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              <span class="mr-1.5 text-xs flex-shrink-0">{{ nodeIcon(node) }}</span>
              <span class="truncate text-xs">{{ node.name }}</span>
            </div>
          </template>

          <!-- 正常树视图 -->
          <template v-else>
            <div v-if="flatTree.length === 0" class="px-4 py-3 text-xs text-gray-400 italic">
              当前文件夹为空
            </div>
            <div
              v-for="{ node, depth } in flatTree"
              :key="node.path"
              @click="handleNodeClick(node, $event)"
              @contextmenu.prevent="showContextMenu($event, node)"
              :style="{ paddingLeft: `${depth * 14 + 8}px` }"
              class="flex items-center py-1 pr-2 text-sm cursor-pointer transition-colors"
              :class="
                node.path === currentFilePath
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              <!-- 展开/折叠箭头（仅目录） -->
              <span class="w-3 flex-shrink-0 text-center mr-0.5 text-xs text-gray-400">
                <template v-if="node.is_dir">{{ node.expanded ? '▾' : '▸' }}</template>
              </span>
              <!-- 图标 -->
              <span class="mr-1.5 text-xs flex-shrink-0">{{ nodeIcon(node) }}</span>
              <!-- 名称 -->
              <span class="truncate text-xs">{{ node.name }}</span>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- 底部工具栏 -->
    <div
      v-if="mode === 'files' && rootFolder"
      class="flex-shrink-0 border-t px-2 py-1.5"
      style="border-color: var(--border-color); background: var(--sidebar-bg)"
    >
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-gray-400 truncate flex-1">{{ rootFolderName }}</span>
        <!-- 新建按钮 -->
        <button
          @click="showNewMenu"
          class="ml-2 flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
          title="新建"
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

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div v-if="contextMenu.node" class="context-menu-items">
          <div class="context-menu-item" @click="handleRename">
            <span class="context-menu-icon">✏️</span>
            <span>重命名</span>
          </div>
          <div class="context-menu-item" @click="handleRevealInFinder">
            <span class="context-menu-icon">📂</span>
            <span>在 {{ getFileManagerName() }} 中显示</span>
          </div>
          <div class="context-menu-item context-menu-item-danger" @click="handleDelete">
            <span class="context-menu-icon">🗑️</span>
            <span>删除</span>
          </div>
        </div>
      </div>

      <!-- 新建菜单 -->
      <div
        v-if="newMenu.visible"
        class="context-menu"
        :style="{ left: newMenu.x + 'px', top: newMenu.y + 'px' }"
      >
        <div class="context-menu-items">
          <div class="context-menu-item" @click="handleNewFile">
            <span class="context-menu-icon">📄</span>
            <span>新建文件</span>
          </div>
          <div class="context-menu-item" @click="handleNewFolder">
            <span class="context-menu-icon">📁</span>
            <span>新建文件夹</span>
          </div>
        </div>
      </div>

      <!-- 重命名对话框 -->
      <div
        v-if="renameDialog.visible"
        class="dialog-overlay"
        @click.self="renameDialog.visible = false"
      >
        <div class="dialog">
          <div class="dialog-title">重命名</div>
          <input
            ref="renameInputRef"
            v-model="renameDialog.newName"
            type="text"
            class="dialog-input"
            @keydown.enter="confirmRename"
            @keydown.esc="renameDialog.visible = false"
          />
          <div class="dialog-buttons">
            <button class="dialog-btn dialog-btn-cancel" @click="renameDialog.visible = false">
              取消
            </button>
            <button class="dialog-btn dialog-btn-confirm" @click="confirmRename">确定</button>
          </div>
        </div>
      </div>

      <!-- 新建对话框 -->
      <div v-if="newDialog.visible" class="dialog-overlay" @click.self="newDialog.visible = false">
        <div class="dialog">
          <div class="dialog-title">{{ newDialog.isFolder ? '新建文件夹' : '新建文件' }}</div>
          <input
            ref="newInputRef"
            v-model="newDialog.name"
            type="text"
            class="dialog-input"
            :placeholder="newDialog.isFolder ? '文件夹名称' : '文件名 (如: note.md)'"
            @keydown.enter="confirmNew"
            @keydown.esc="newDialog.visible = false"
          />
          <div class="dialog-buttons">
            <button class="dialog-btn dialog-btn-cancel" @click="newDialog.visible = false">
              取消
            </button>
            <button class="dialog-btn dialog-btn-confirm" @click="confirmNew">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { confirm } from '@tauri-apps/plugin-dialog';
import { getFileManagerName } from '../../utils/platform';
import type { TreeNode } from '../../composables/useWorkspaceSession';

export interface OutlineItem {
  text: string;
  level: number;
  pos: number;
}

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

function nodeIcon(node: TreeNode): string {
  if (node.is_dir) return node.expanded ? '📂' : '📁';
  if (node.is_md) return '📝';
  if (node.is_image) return '🖼️';
  return '📄';
}

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

const renameInputRef = ref<HTMLInputElement | null>(null);
const newInputRef = ref<HTMLInputElement | null>(null);

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
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
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
  nextTick(() => newInputRef.value?.focus());
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
        nextTick(() => {
          renameInputRef.value?.focus();
          renameInputRef.value?.select();
        });
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

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  min-width: 300px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.dialog-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--sidebar-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.dialog-input:focus {
  border-color: var(--primary-color);
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.dialog-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.dialog-btn-cancel {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-color);
  opacity: 0.8;
}
.dark .dialog-btn-cancel {
  background: rgba(255, 255, 255, 0.1);
}
.dialog-btn-cancel:hover {
  opacity: 1;
}

.dialog-btn-confirm {
  background: var(--primary-color);
  color: white;
}
.dialog-btn-confirm:hover {
  filter: brightness(1.1);
}
</style>
