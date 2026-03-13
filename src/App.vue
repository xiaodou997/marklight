<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { open, confirm, message } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useFileStore } from './stores/file';
import { useSettingsStore } from './stores/settings';
import { useFileOperations, type AutoSaveStatus } from './composables/useFileOperations';
import { useExportActions } from './composables/useExportActions';
import { useMenuEvents } from './composables/useMenuEvents';
import EditorToolbar from './components/Toolbar/EditorToolbar.vue';
import MarkdownEditor from './components/Editor/MarkdownEditor.vue';
import StatusBar from './components/Layout/StatusBar.vue';
import Sidebar, { OutlineItem, FileInfo } from './components/Editor/Sidebar.vue';
import SettingsModal from './components/Settings/SettingsModal.vue';
import ShortcutsModal from './components/Editor/ShortcutsModal.vue';
import CommandPalette from './components/Editor/CommandPalette.vue';
import TitleBar from './components/Layout/TitleBar.vue';
import { isModKey, isMac } from './utils/platform';
import pkg from '../package.json';

const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const { handleNew, handleOpen, handleSave, handleSaveAs, setupAutoSave } = useFileOperations();
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null);
const appWindow = getCurrentWindow();
const appVersion = pkg.version;

const isSidebarOpen = ref(true);
const isSourceMode = ref(false);
const sidebarMode = ref<'outline' | 'files'>('outline');

// 视图模式: editor (编辑) | image (图片查看)
const activeViewMode = ref<'editor' | 'image'>('editor');
const imagePreviewUrl = ref<string | null>(null);
const isFullscreenPreview = ref(false);

const { exportHtml, exportPdf, copyToWechat } = useExportActions({
  editorRef,
  activeViewMode,
  fileStore,
  settingsStore
});

// 自动保存状态
const autoSaveStatus = ref<AutoSaveStatus | null>(null);

// 图片粘贴警告
const imagePasteWarning = ref<string | null>(null);

// 命令面板
const isCommandPaletteOpen = ref(false);

// 快捷键弹窗
const isShortcutsModalOpen = ref(false);

// 统计与大纲数据
const stats = reactive({
  wordCount: 0,
  cursor: { line: 1, col: 1 },
  selectionText: ''
});
const outlineItems = ref<OutlineItem[]>([]);

// 文件树数据
const files = ref<FileInfo[]>([]);
const currentFolder = ref<string | null>(null);
const watchedFolder = ref<string | null>(null);

// 新建文件后需要重命名的文件路径
const pendingRenamePath = ref<string | null>(null);

// 自动保存清理函数
let cleanupAutoSave: (() => void) | null = null;
let onWindowDragOver: ((e: DragEvent) => void) | null = null;
let onWindowDrop: ((e: DragEvent) => void) | null = null;
const handleImagePasteWarning = (event: Event) => {
  const detail = (event as CustomEvent).detail as string | undefined;
  if (!detail) return;
  imagePasteWarning.value = detail;
  // 3秒后自动消失
  setTimeout(() => {
    imagePasteWarning.value = null;
  }, 3000);
};

// 加载文件列表
async function loadFiles(folderPath: string) {
  try {
    const result = await invoke<FileInfo[]>('list_directory', { path: folderPath });
    files.value = result;
    currentFolder.value = folderPath;
    // 开启监听
    if (watchedFolder.value && watchedFolder.value !== folderPath) {
      await invoke('unwatch_directory', { path: watchedFolder.value });
      watchedFolder.value = null;
    }
    if (watchedFolder.value !== folderPath) {
      await invoke('watch_directory', { path: folderPath });
      watchedFolder.value = folderPath;
    }
  } catch (error) {
    console.error('Failed to list directory:', error);
  }
}

// 检查未保存的更改
async function checkUnsavedChanges() {
  if (fileStore.currentFile.isDirty) {
    const confirmed = await confirm('当前文件有未保存的更改，是否放弃更改？', {
      title: '未保存的更改',
      kind: 'warning'
    });
    return confirmed;
  }
  return true;
}

// 打开文件夹
async function handleOpenFolder() {
  const selected = await open({ 
    directory: true,
    title: '选择文件夹'
  });
  if (selected && typeof selected === 'string') {
    await loadFiles(selected);
    sidebarMode.value = 'files';
  }
}

// 打开文件
async function handleOpenFile(path: string) {
  if (!await checkUnsavedChanges()) return;
  
  try {
    const content = await invoke<string>('read_file', { path });
    fileStore.setFile(content, path);
    activeViewMode.value = 'editor';
    imagePreviewUrl.value = null;
  } catch (error) {
    console.error('Failed to read file:', error);
  }
}

// 导航到子文件夹
async function handleNavigateFolder(path: string) {
  await loadFiles(path);
}

// 返回上级文件夹
async function handleNavigateUp() {
  if (!currentFolder.value) return;
  const lastSlashIndex = Math.max(currentFolder.value.lastIndexOf('/'), currentFolder.value.lastIndexOf('\\'));
  if (lastSlashIndex !== -1) {
    const parentPath = currentFolder.value.substring(0, lastSlashIndex) || (isMac ? '/' : '');
    await loadFiles(parentPath);
  }
}

// 刷新文件列表
async function refreshFiles() {
  if (currentFolder.value) {
    await loadFiles(currentFolder.value);
  }
}

// 处理文件重命名
async function handleFileRenamed(oldPath: string, newName: string) {
  try {
    const newPath = await invoke<string>('rename_file', { oldPath, newName });
    await refreshFiles();
    // 如果重命名的是当前打开的文件，更新路径
    if (fileStore.currentFile.path === oldPath) {
      fileStore.currentFile.path = newPath;
    }
  } catch (error) {
    await message(`重命名失败: ${error}`, { title: '错误', kind: 'error' });
  }
}

// 处理文件删除
async function handleFileDeleted(path: string) {
  try {
    await invoke('delete_file', { path });
    await refreshFiles();
    // 如果删除的是当前打开的文件，清空
    if (fileStore.currentFile.path === path) {
      fileStore.reset();
      activeViewMode.value = 'editor';
    }
  } catch (error) {
    await message(`删除失败: ${error}`, { title: '错误', kind: 'error' });
  }
}

// 处理新建文件/文件夹
async function handleFileCreated(name: string, isFolder: boolean) {
  if (!currentFolder.value) return;
  
  // 特殊标记：新建文件并自动重命名
  if (name === '__AUTO_RENAME__' && !isFolder) {
    await handleNewFileWithRename();
    return;
  }
  
  try {
    const path = await invoke<string>(
      isFolder ? 'create_folder' : 'create_file',
      { dir: currentFolder.value, name }
    );
    await refreshFiles();
    // 如果是文件，自动打开
    if (!isFolder) {
      handleOpenFile(path);
    }
  } catch (error) {
    await message(`创建失败: ${error}`, { title: '错误', kind: 'error' });
  }
}

// 新建文件并自动进入重命名状态
async function handleNewFileWithRename() {
  if (!currentFolder.value) return;
  // 生成默认文件名
  const defaultName = '未命名.md';
  try {
    const path = await invoke<string>('create_file', { 
      dir: currentFolder.value, 
      name: defaultName 
    });
    await refreshFiles();
    // 自动打开文件
    handleOpenFile(path);
    // 设置待重命名路径，触发 Sidebar 打开重命名对话框
    pendingRenamePath.value = path;
  } catch (error) {
    await message(`创建失败: ${error}`, { title: '错误', kind: 'error' });
  }
}

// 重命名完成，清除 pendingRenamePath
function handleRenameCompleted() {
  pendingRenamePath.value = null;
}

// 打开图片预览
async function handleOpenImage(path?: string) {
  if (path) {
    if (!await checkUnsavedChanges()) return;
    activeViewMode.value = 'image';
    imagePreviewUrl.value = convertFileSrc(path);
    isFullscreenPreview.value = false;
  } else {
    isFullscreenPreview.value = false;
  }
}

// 关闭全屏预览
function closeFullscreenPreview() {
  isFullscreenPreview.value = false;
}

// 在 Finder 中显示
async function handleRevealInFinder(path: string) {
  try {
    await invoke('reveal_in_finder', { path });
  } catch (error) {
    await message(`无法在 Finder 中显示: ${error}`, { title: '错误', kind: 'error' });
  }
}


function handleEditorUpdate(data: any) {
  if (data.wordCount !== undefined) stats.wordCount = data.wordCount;
  if (data.cursor) stats.cursor = data.cursor;
  if (data.selectionText !== undefined) stats.selectionText = data.selectionText;
  if (data.outline) outlineItems.value = data.outline;
}

function scrollToHeading(pos: number) {
  editorRef.value?.scrollToPos(pos);
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

function toggleSourceMode() {
  isSourceMode.value = !isSourceMode.value;
}


// 编辑器操作
function editorAction(_action: string) {
  if (!editorRef.value || activeViewMode.value !== 'editor') return;
  const view = (editorRef.value as any).getEditorView?.();
  if (!view) return;
  
  // 原生 PredefinedMenuItem 现在会自动处理 undo, redo, cut, copy, paste, select_all
  // 我们只需要确保编辑器获得焦点即可
  view.focus();
}

// 监听剪贴板复制事件，确保复制的是 Markdown 源码而不是 HTML
function onCopy(event: ClipboardEvent) {
  if (!editorRef.value || isSourceMode.value || activeViewMode.value !== 'editor') return;
  const view = (editorRef.value as any).getEditorView?.();
  if (!view || !view.hasFocus()) return;

  const { state } = view;
  const { from, to } = state.selection;
  if (from === to) return;

  const content = state.doc.cut(from, to);
  const markdown = serializeMarkdown(content);
  
  event.clipboardData?.setData('text/plain', markdown);
  event.preventDefault();
}

// 更新窗口标题
function updateWindowTitle() {
  const file = fileStore.currentFile;
  // 兼容不同系统的路径分隔符
  let fileName = '未命名';
  if (activeViewMode.value === 'editor') {
    fileName = file.path ? file.path.split(/[/\\]/).pop() || '未命名' : '未命名';
  } else if (activeViewMode.value === 'image' && imagePreviewUrl.value) {
    fileName = '查看图片'; 
  }
  
  const title = file.isDirty ? `${fileName} ●` : fileName;
  appWindow.setTitle(title).catch(err => {
    // 静默处理，避免控制台报错影响体验
    if (!err.includes('window.set_title not allowed')) {
      console.error('Failed to set window title:', err);
    }
  });
}

// 监听文件状态变化（路径、修改状态、内容等）
watch(() => [fileStore.currentFile, activeViewMode.value, imagePreviewUrl.value], () => {
  const file = fileStore.currentFile;
  if (file.path && activeViewMode.value === 'editor') {
    // 兼容提取文件夹路径
    const lastSlashIndex = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'));
    if (lastSlashIndex !== -1) {
      const folder = file.path.substring(0, lastSlashIndex);
      if (folder && folder !== currentFolder.value) {
        loadFiles(folder);
      }
    }
  }
  updateWindowTitle();
}, { deep: true });

// 初始化
onMounted(async () => {
  updateWindowTitle();
  await settingsStore.init();
  document.addEventListener('copy', onCopy);

  const logDrag = (label: string, e: DragEvent) => {
    console.log(`[DragDebug] ${label}`, {
      types: e.dataTransfer?.types,
      files: e.dataTransfer?.files?.length ?? 0,
      x: e.clientX,
      y: e.clientY
    });
  };
  onWindowDragOver = (e: DragEvent) => {
    logDrag('window dragover', e);
  };
  onWindowDrop = (e: DragEvent) => {
    logDrag('window drop', e);
  };
  window.addEventListener('dragover', onWindowDragOver, true);
  window.addEventListener('drop', onWindowDrop, true);
  
  // 设置自动保存
  cleanupAutoSave = setupAutoSave(autoSaveStatus);
  
  // 监听图片粘贴警告事件
  window.addEventListener('image-paste-warning', handleImagePasteWarning as EventListener);
  
  // 快捷键处理
  const handleKeyDown = (e: KeyboardEvent) => {
    // F12 打开开发者工具
    if (e.key === 'F12') {
      // Tauri 2.x 中，devtools: true 时 F12 应该自动工作
      // 如果没有工作，提示用户使用右键菜单
      console.log('F12 pressed - developer tools should open');
    }
    
    // 命令面板快捷键: Cmd+Shift+P
    if (isModKey(e) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      isCommandPaletteOpen.value = true;
    }
    
    // 焦点模式快捷键: Cmd+Shift+F (macOS) 或 F11
    if (isModKey(e) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      settingsStore.toggleFocusMode();
    }
    
    // Esc 退出焦点模式或图片预览
    if (e.key === 'Escape') {
      if (isFullscreenPreview.value) {
        isFullscreenPreview.value = false;
      } else if (settingsStore.isFocusMode) {
        settingsStore.toggleFocusMode();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('copy', onCopy);
  
  // 清理自动保存
  if (cleanupAutoSave) {
    cleanupAutoSave();
  }
  
  // 取消目录监听
  if (watchedFolder.value) {
    void invoke('unwatch_directory', { path: watchedFolder.value });
    watchedFolder.value = null;
  }

  // 移除图片粘贴警告监听
  window.removeEventListener('image-paste-warning', handleImagePasteWarning as EventListener);

  if (onWindowDragOver) {
    window.removeEventListener('dragover', onWindowDragOver, true);
    onWindowDragOver = null;
  }
  if (onWindowDrop) {
    window.removeEventListener('drop', onWindowDrop, true);
    onWindowDrop = null;
  }
});

// 监听原生菜单事件
useMenuEvents({
  handleNew,
  handleOpen,
  handleOpenFolder,
  handleSave,
  handleSaveAs,
  exportHtml,
  exportPdf,
  copyToWechat,
  editorAction,
  toggleSidebar,
  setSidebarMode: (mode) => { sidebarMode.value = mode; },
  setSidebarOpen: (open) => { isSidebarOpen.value = open; },
  toggleSourceMode,
  openSettings: () => settingsStore.openModal(),
  openSearch: (showReplace) => editorRef.value?.openSearch(showReplace),
  handleOpenNewWindow,
  toggleFocusMode: () => settingsStore.toggleFocusMode(),
  openCommandPalette: () => { isCommandPaletteOpen.value = true; },
  openShortcuts: () => { isShortcutsModalOpen.value = true; },
  showAbout,
  toggleFullscreen,
  handleQuit,
});

// 显示关于对话框
function showAbout() {
  message(`墨光 (MarkLight) v${appVersion}\n\n一款高性能、自研内核的 Markdown 编辑器\n\nGitHub: https://github.com/xiaodou997/marklight\nGitee: https://gitee.com/xiaodou997/marklight\n\n© 2026 luoxiaodou`, {
    title: '关于',
    kind: 'info'
  });
}

// 切换全屏
async function toggleFullscreen() {
  await appWindow.setFullscreen(!await appWindow.isFullscreen());
}

// 处理退出
async function handleQuit() {
  if (fileStore.currentFile.isDirty) {
    const confirmed = await confirm('文件未保存，是否保存？', {
      title: '未保存的更改',
      kind: 'warning'
    });
    if (confirmed) {
      await handleSave();
    }
  }
  await appWindow.destroy();
}

// 处理命令面板命令
function handleCommandExecute(command: { id: string }) {
  switch (command.id) {
    case 'file.new': handleNew(); break;
    case 'file.open': handleOpen(); break;
    case 'file.save': handleSave(); break;
    case 'file.saveAs': handleSaveAs(); break;
    case 'file.newWindow': handleOpenNewWindow(); break;
    case 'edit.find': editorRef.value?.openSearch(false); break;
    case 'edit.replace': editorRef.value?.openSearch(true); break;
    case 'view.focusMode': settingsStore.toggleFocusMode(); break;
    case 'view.toggleSidebar': toggleSidebar(); break;
    case 'view.toggleOutline': sidebarMode.value = 'outline'; isSidebarOpen.value = true; break;
    case 'export.pdf': exportPdf(); break;
    case 'export.wechat': copyToWechat(); break;
    case 'settings.open': settingsStore.openModal(); break;
  }
}

// 打开新窗口
async function handleOpenNewWindow(path?: string) {
  await invoke('open_new_window', { path });
}

// 监听新窗口打开文件事件
let unlistenOpenFile: (() => void) | null = null;
let unlistenCloseRequest: (() => void) | null = null;
let unlistenFileChanged: (() => void) | null = null;
let unlistenFileArgs: (() => void) | null = null;
let unlistenTauriOpen: (() => void) | null = null;

onMounted(async () => {
  unlistenOpenFile = await listen<string>('open-file-in-new-window', (event) => {
    const path = event.payload;
    handleOpenFile(path);
  });

  // 监听后端文件变动通知
  unlistenFileChanged = await listen('file-changed', () => {
    refreshFiles();
  });
  
  // 监听窗口关闭请求
  unlistenCloseRequest = await listen('window-close-requested', async () => {
    if (fileStore.currentFile.isDirty) {
    const confirmed = await confirm('文件未保存，是否保存？\n\n选择"确定"保存并关闭\n选择"取消"放弃关闭', {
      title: '未保存的更改',
      kind: 'warning'
    });
      if (confirmed) {
        await handleSave();
      } else {
        return; // 用户取消，不关闭
      }
    }
    // 销毁窗口
    await appWindow.destroy();
  });
  
  // Windows/Linux: 监听命令行参数打开文件
  unlistenFileArgs = await listen<string>('open-file-args', (event) => {
    const path = event.payload;
    handleOpenFile(path);
  });
  
  // macOS: 监听文件关联打开
  unlistenTauriOpen = await listen<string>('tauri://open', (event) => {
    const path = event.payload;
    handleOpenFile(path);
  });
});

onUnmounted(() => {
  if (unlistenOpenFile) unlistenOpenFile();
  if (unlistenCloseRequest) unlistenCloseRequest();
  if (unlistenFileChanged) unlistenFileChanged();
  if (unlistenFileArgs) unlistenFileArgs();
  if (unlistenTauriOpen) unlistenTauriOpen();
});

</script>

<template>
  <div 
    class="h-screen flex flex-col overflow-hidden font-sans select-none"
    :class="{ 'focus-mode': settingsStore.isFocusMode }"
    style="background-color: var(--bg-color); color: var(--text-color);"
  >
    <!-- Windows/Linux 自定义标题栏 (沉浸式且带菜单) -->
    <TitleBar v-if="!isMac" />

    <!-- 工具栏 - 焦点模式下隐藏，但悬停顶部时显示 -->
    <div 
      class="toolbar-container transition-opacity duration-300"
      :class="{ 'opacity-0 pointer-events-none': settingsStore.isFocusMode }"
    >
      <EditorToolbar
        ref="toolbarRef"
        :is-source-mode="isSourceMode"
        @toggle-sidebar="toggleSidebar"
        @toggle-source="toggleSourceMode"
        @copy-wechat="copyToWechat"
      />
    </div>
    
    <div class="flex-1 flex overflow-hidden">
      <!-- 侧边栏 -->
      <aside 
        v-show="isSidebarOpen && !isSourceMode && !settingsStore.isFocusMode"
        class="w-64 flex-shrink-0 transition-all duration-300"
      >
        <Sidebar
          v-model:mode="sidebarMode"
          :outline-items="outlineItems"
          :files="files"
          :current-folder="currentFolder"
          :current-file-path="fileStore.currentFile.path"
          :pending-rename-path="pendingRenamePath"
          @scroll-to="scrollToHeading"
          @open-folder="handleOpenFolder"
          @open-file="handleOpenFile"
          @open-image="handleOpenImage"
          @navigate-folder="handleNavigateFolder"
          @navigate-up="handleNavigateUp"
          @open-file-in-new-window="handleOpenNewWindow"
          @refresh-files="refreshFiles"
          @file-renamed="handleFileRenamed"
          @file-deleted="handleFileDeleted"
          @file-created="handleFileCreated"
          @reveal-in-finder="handleRevealInFinder"
          @rename-completed="handleRenameCompleted"
        />
      </aside>

      <!-- 编辑器区域 -->
      <main 
        class="flex-1 relative overflow-hidden select-text"
        :class="{ 'focus-mode-editor': settingsStore.isFocusMode }"
      >
        <!-- 实时渲染模式 -->
        <MarkdownEditor
          v-if="activeViewMode === 'editor' && !isSourceMode"
          :key="fileStore.currentFile.path || 'new-file'"
          ref="editorRef"
          :initial-content="fileStore.currentFile.content"
          @update="handleEditorUpdate"
        />
        
        <!-- 图片查看模式 -->
        <div 
          v-else-if="activeViewMode === 'image' && imagePreviewUrl" 
          class="h-full w-full flex items-center justify-center bg-gray-50 p-12 overflow-auto"
        >
          <div class="relative group max-w-full max-h-full">
            <img 
              :src="imagePreviewUrl" 
              class="max-w-full max-h-full object-contain shadow-md rounded border border-gray-200 cursor-zoom-in bg-white" 
              title="双击全屏预览"
              @dblclick="isFullscreenPreview = true"
            />
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none">
              双击全屏查看
            </div>
          </div>
        </div>

        <!-- 源码模式 (极简实现) -->
        <div v-else class="h-full w-full p-8">
          <textarea
            class="w-full h-full resize-none outline-none font-mono text-sm leading-relaxed text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100"
            :value="fileStore.currentFile.content"
            @input="e => fileStore.setContent((e.target as HTMLTextAreaElement).value)"
            placeholder="在此输入 Markdown 源码..."
          ></textarea>
        </div>
      </main>
    </div>

    <!-- 状态栏 - 焦点模式下隐藏 -->
    <div 
      class="statusbar-container transition-opacity duration-300"
      :class="{ 'opacity-0 pointer-events-none': settingsStore.isFocusMode }"
    >
      <StatusBar 
        :word-count="stats.wordCount"
        :cursor="stats.cursor"
        :selection-text="stats.selectionText"
        :auto-save-status="autoSaveStatus"
        :image-paste-warning="imagePasteWarning"
      />
    </div>

    <!-- 设置弹窗 -->
    <SettingsModal />

    <!-- 快捷键弹窗 -->
    <ShortcutsModal
      :visible="isShortcutsModalOpen"
      @close="isShortcutsModalOpen = false"
    />

    <!-- 命令面板 -->
    <CommandPalette
      :visible="isCommandPaletteOpen"
      :files="files"
      :current-folder="currentFolder"
      @close="isCommandPaletteOpen = false"
      @execute="handleCommandExecute"
      @open-file="handleOpenFile"
    />

    <!-- 图片全屏预览弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div 
          v-if="isFullscreenPreview && imagePreviewUrl" 
          class="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 cursor-zoom-out"
          @click="closeFullscreenPreview"
        >
          <img 
            :src="imagePreviewUrl" 
            class="max-w-full max-h-full object-contain" 
            @click.stop
          />
          <button 
            class="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            @click="closeFullscreenPreview"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
