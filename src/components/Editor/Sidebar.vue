<template>
  <div class="sidebar-container h-full flex flex-col bg-gray-50 border-r border-gray-100 select-none">
    <!-- 标签切换 -->
    <div class="flex border-b border-gray-200 bg-white">
      <button 
        @click="$emit('update:mode', 'outline')"
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="mode === 'outline' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'"
      >
        大纲
      </button>
      <button 
        @click="$emit('update:mode', 'files')"
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="mode === 'files' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'"
      >
        文件
      </button>
    </div>

    <!-- 大纲模式 -->
    <div v-if="mode === 'outline'" class="flex-1 overflow-y-auto p-4">
      <div v-if="outlineItems.length === 0" class="text-xs text-gray-400 px-2 italic">
        暂无标题
      </div>
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
      <div v-if="!currentFolder" class="flex-1 p-4 text-xs text-gray-400 italic">
        请打开文件夹以查看文件列表
        <button 
          @click="$emit('open-folder')"
          class="block mt-2 text-blue-500 hover:underline"
        >
          打开文件夹
        </button>
      </div>
      <template v-else>
        <!-- 固定在顶部的操作栏 -->
        <div class="flex-shrink-0 bg-white border-b border-gray-100">
          <!-- 搜索框 -->
          <div class="px-3 py-2">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索文件..."
              class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
            />
          </div>
          <!-- 返回上级按钮 -->
          <div 
            @click="$emit('navigate-up')"
            class="flex items-center py-1.5 px-3 text-xs text-gray-500 hover:bg-gray-100 cursor-pointer"
          >
            <span class="mr-1.5">⬆️</span>
            <span class="truncate">返回上级</span>
          </div>
        </div>
        
        <!-- 文件列表（可滚动） -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="filteredFiles.length === 0" class="p-4 text-xs text-gray-400 italic">
            {{ searchQuery ? '没有匹配的文件' : '当前文件夹为空' }}
          </div>
          <nav v-else class="py-1">
            <div
              v-for="file in filteredFiles"
              :key="file.path"
              @click="handleFileClick(file, $event)"
              @contextmenu.prevent="showContextMenu($event, file)"
              class="flex items-center py-1.5 px-3 text-sm cursor-pointer transition-colors"
              :class="[
                file.path === currentFilePath 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100',
                file.is_dir ? 'font-medium' : ''
              ]"
            >
              <!-- 图标 -->
              <span class="mr-2 text-sm">
                <template v-if="file.is_dir">📁</template>
                <template v-else-if="file.is_md">📝</template>
                <template v-else>📄</template>
              </span>
              <span class="truncate">{{ file.name }}</span>
            </div>
          </nav>
        </div>
      </template>
    </div>

    <!-- 底部路径面包屑 -->
    <div v-if="mode === 'files' && currentFolder" class="border-t border-gray-200 bg-white px-2 py-1.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center text-[10px] text-gray-400 flex-wrap flex-1">
          <template v-for="(segment, index) in pathSegments" :key="index">
            <span 
              v-if="index > 0" 
              class="mx-0.5 text-gray-300"
            >/</span>
            <span 
              @click="handlePathClick(index)"
              class="cursor-pointer hover:text-blue-500 transition-colors"
              :class="{ 'text-gray-600 font-medium': index === pathSegments.length - 1 }"
            >{{ segment.name }}</span>
          </template>
        </div>
        <!-- 新建按钮 -->
        <button 
          @click="showNewMenu"
          class="ml-2 text-gray-400 hover:text-blue-500 transition-colors"
          title="新建"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        <div v-if="contextMenu.file" class="context-menu-items">
          <div class="context-menu-item" @click="handleRename">
            <span class="context-menu-icon">✏️</span>
            <span>重命名</span>
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
      <div v-if="renameDialog.visible" class="dialog-overlay" @click.self="renameDialog.visible = false">
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
            <button class="dialog-btn dialog-btn-cancel" @click="renameDialog.visible = false">取消</button>
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
            <button class="dialog-btn dialog-btn-cancel" @click="newDialog.visible = false">取消</button>
            <button class="dialog-btn dialog-btn-confirm" @click="confirmNew">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';

export interface OutlineItem {
  text: string;
  level: number;
  pos: number;
}

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_md: boolean;
}

const props = defineProps<{
  mode: 'outline' | 'files';
  outlineItems: OutlineItem[];
  files: FileInfo[];
  currentFolder: string | null;
  currentFilePath: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:mode', mode: 'outline' | 'files'): void;
  (e: 'scroll-to', pos: number): void;
  (e: 'open-folder'): void;
  (e: 'open-file', path: string): void;
  (e: 'open-file-in-new-window', path: string): void;
  (e: 'navigate-folder', path: string): void;
  (e: 'navigate-up'): void;
  (e: 'refresh-files'): void;
  (e: 'file-renamed', oldPath: string, newPath: string): void;
  (e: 'file-deleted', path: string): void;
  (e: 'file-created', name: string, isFolder: boolean): void;
}>();

const searchQuery = ref('');

// 右键菜单状态
const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  file: FileInfo | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  file: null,
});

// 新建菜单状态
const newMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
}>({
  visible: false,
  x: 0,
  y: 0,
});

// 重命名对话框
const renameDialog = ref<{
  visible: boolean;
  newName: string;
}>({
  visible: false,
  newName: '',
});

// 新建对话框
const newDialog = ref<{
  visible: boolean;
  name: string;
  isFolder: boolean;
}>({
  visible: false,
  name: '',
  isFolder: false,
});

const renameInputRef = ref<HTMLInputElement | null>(null);
const newInputRef = ref<HTMLInputElement | null>(null);

// 过滤文件
const filteredFiles = computed(() => {
  if (!searchQuery.value) return props.files;
  const query = searchQuery.value.toLowerCase();
  return props.files.filter(file => 
    file.name.toLowerCase().includes(query)
  );
});

// 路径分段
const pathSegments = computed(() => {
  if (!props.currentFolder) return [];
  const parts = props.currentFolder.split('/').filter(Boolean);
  let path = '';
  return parts.map(name => {
    path = path ? `${path}/${name}` : `/${name}`;
    return { name, path };
  });
});

function handleFileClick(file: FileInfo, event?: MouseEvent) {
  // Cmd (macOS) 或 Ctrl (Windows/Linux) + 单击：在新窗口打开
  if (event && (event.metaKey || event.ctrlKey) && !file.is_dir) {
    emit('open-file-in-new-window', file.path);
    return;
  }
  
  if (file.is_dir) {
    emit('navigate-folder', file.path);
  } else {
    emit('open-file', file.path);
  }
}

function handlePathClick(index: number) {
  const segment = pathSegments.value[index];
  if (segment) {
    emit('navigate-folder', segment.path);
  }
}

// 显示右键菜单
function showContextMenu(event: MouseEvent, file: FileInfo) {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    file,
  };
}

// 显示新建菜单
function showNewMenu() {
  const btn = event?.target as HTMLElement;
  const rect = btn?.getBoundingClientRect();
  newMenu.value = {
    visible: true,
    x: rect ? rect.left : 0,
    y: rect ? rect.bottom + 4 : 0,
  };
}

// 重命名
function handleRename() {
  if (!contextMenu.value.file) return;
  renameDialog.value.newName = contextMenu.value.file.name;
  renameDialog.value.visible = true;
  contextMenu.value.visible = false;
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

// 确认重命名
function confirmRename() {
  if (!contextMenu.value.file || !renameDialog.value.newName.trim()) return;
  emit('file-renamed', contextMenu.value.file.path, renameDialog.value.newName.trim());
  renameDialog.value.visible = false;
}

// 删除
function handleDelete() {
  if (!contextMenu.value.file) return;
  const file = contextMenu.value.file;
  const message = file.is_dir 
    ? `确定删除文件夹 "${file.name}" 及其所有内容？`
    : `确定删除文件 "${file.name}"？`;
  
  if (confirm(message)) {
    emit('file-deleted', file.path);
  }
  contextMenu.value.visible = false;
}

// 新建文件
function handleNewFile() {
  newDialog.value = {
    visible: true,
    name: '',
    isFolder: false,
  };
  newMenu.value.visible = false;
  nextTick(() => {
    newInputRef.value?.focus();
  });
}

// 新建文件夹
function handleNewFolder() {
  newDialog.value = {
    visible: true,
    name: '',
    isFolder: true,
  };
  newMenu.value.visible = false;
  nextTick(() => {
    newInputRef.value?.focus();
  });
}

// 确认新建
function confirmNew() {
  if (!newDialog.value.name.trim()) return;
  emit('file-created', newDialog.value.name.trim(), newDialog.value.isFolder);
  newDialog.value.visible = false;
}

// 点击外部关闭菜单
function handleClickOutside() {
  contextMenu.value.visible = false;
  newMenu.value.visible = false;
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
/* 右键菜单样式 */
.context-menu {
  position: fixed;
  z-index: 1000;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 140px;
  padding: 4px 0;
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
  color: #374151;
  cursor: pointer;
  transition: background-color 0.1s;
}

.context-menu-item:hover {
  background-color: #f3f4f6;
}

.context-menu-item-danger {
  color: #dc2626;
}

.context-menu-item-danger:hover {
  background-color: #fef2f2;
}

.context-menu-icon {
  margin-right: 8px;
  font-size: 14px;
}

/* 对话框样式 */
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
  background: white;
  border-radius: 12px;
  padding: 20px;
  min-width: 300px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1f2937;
}

.dialog-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.dialog-input:focus {
  border-color: #3b82f6;
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
  background: #f3f4f6;
  color: #6b7280;
}

.dialog-btn-cancel:hover {
  background: #e5e7eb;
}

.dialog-btn-confirm {
  background: #3b82f6;
  color: white;
}

.dialog-btn-confirm:hover {
  background: #2563eb;
}
</style>