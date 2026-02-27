<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useFileStore } from './stores/file';
import { useSettingsStore } from './stores/settings';
import { useFileOperations, type AutoSaveStatus } from './composables/useFileOperations';
import EditorToolbar from './components/Toolbar/EditorToolbar.vue';
import MarkdownEditor from './components/Editor/MarkdownEditor.vue';
import StatusBar from './components/Layout/StatusBar.vue';
import Sidebar, { OutlineItem, FileInfo } from './components/Editor/Sidebar.vue';
import SettingsModal from './components/Settings/SettingsModal.vue';
import CommandPalette from './components/Editor/CommandPalette.vue';
import { renderToWechatHtml } from './utils/wechat-renderer';
import { serializeMarkdown } from './components/Editor/core/markdown';

const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const { handleNew, handleOpen, handleSave, handleSaveAs, setupAutoSave } = useFileOperations();
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null);
const appWindow = getCurrentWindow();

const isSidebarOpen = ref(true);
const isSourceMode = ref(false);
const sidebarMode = ref<'outline' | 'files'>('outline');

// 自动保存状态
const autoSaveStatus = ref<AutoSaveStatus | null>(null);

// 图片粘贴警告
const imagePasteWarning = ref<string | null>(null);

// 命令面板
const isCommandPaletteOpen = ref(false);

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

// 自动保存清理函数
let cleanupAutoSave: (() => void) | null = null;

// 加载文件列表
async function loadFiles(folderPath: string) {
  try {
    const result = await invoke<FileInfo[]>('list_directory', { path: folderPath });
    files.value = result;
    currentFolder.value = folderPath;
  } catch (error) {
    console.error('Failed to list directory:', error);
  }
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
  try {
    const content = await invoke<string>('read_file', { path });
    fileStore.setFile(content, path);
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
  const parentPath = currentFolder.value.substring(0, currentFolder.value.lastIndexOf('/'));
  if (parentPath) {
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
    alert('重命名失败: ' + error);
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
    }
  } catch (error) {
    alert('删除失败: ' + error);
  }
}

// 处理新建文件/文件夹
async function handleFileCreated(name: string, isFolder: boolean) {
  if (!currentFolder.value) return;
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
    alert('创建失败: ' + error);
  }
}

// 导出为 HTML
async function exportHtml() {
  if (!editorRef.value) return;
  const doc = editorRef.value.getDoc();
  if (!doc) return;
  const html = renderToWechatHtml(doc);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (fileStore.currentFile.path?.split('/').pop()?.replace(/\.md$/, '') || 'document') + '.html';
  a.click();
  URL.revokeObjectURL(url);
}

// 导出为 PDF
async function exportPdf() {
  try {
    await invoke('print_document');
  } catch (error) {
    console.error('PDF 导出失败:', error);
    alert('PDF 导出失败: ' + error);
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

async function copyToWechat() {
  if (!editorRef.value) return;
  const doc = editorRef.value.getDoc();
  if (!doc) return;
  const html = renderToWechatHtml(doc, settingsStore.settings.wechatTheme);
  try {
    const type = 'text/html';
    const blob = new Blob([html], { type });
    const data = [new ClipboardItem({ [type]: blob })];
    await navigator.clipboard.write(data);
    alert('🎉 已转换并复制到剪贴板！');
  } catch (err) {
    alert('复制失败');
  }
}

// 编辑器操作
function editorAction(_action: string) {
  if (!editorRef.value) return;
  const view = (editorRef.value as any).getEditorView?.();
  if (!view) return;
  
  // 原生 PredefinedMenuItem 现在会自动处理 undo, redo, cut, copy, paste, select_all
  // 我们只需要确保编辑器获得焦点即可
  view.focus();
}

// 监听剪贴板复制事件，确保复制的是 Markdown 源码而不是 HTML
function onCopy(event: ClipboardEvent) {
  if (!editorRef.value || isSourceMode.value) return;
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
  const fileName = file.path 
    ? file.path.split(/[/\\]/).pop() || '未命名'
    : '未命名';
  const title = file.isDirty ? `${fileName} ●` : fileName;
  appWindow.setTitle(title).catch(err => {
    // 静默处理，避免控制台报错影响体验
    if (!err.includes('window.set_title not allowed')) {
      console.error('Failed to set window title:', err);
    }
  });
}

// 监听文件状态变化（路径、修改状态、内容等）
watch(() => fileStore.currentFile, (file) => {
  if (file.path) {
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
onMounted(() => {
  updateWindowTitle();
  settingsStore.initTheme();
  settingsStore.initFocusMode();
  document.addEventListener('copy', onCopy);
  
  // 设置自动保存
  cleanupAutoSave = setupAutoSave(autoSaveStatus);
  
  // 监听图片粘贴警告事件
  const handleImagePasteWarning = (e: CustomEvent) => {
    imagePasteWarning.value = e.detail;
    // 3秒后自动消失
    setTimeout(() => {
      imagePasteWarning.value = null;
    }, 3000);
  };
  window.addEventListener('image-paste-warning', handleImagePasteWarning as EventListener);
  
  // 快捷键处理
  const handleKeyDown = (e: KeyboardEvent) => {
    // 命令面板快捷键: Cmd+Shift+P
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      isCommandPaletteOpen.value = true;
    }
    
    // 焦点模式快捷键: Cmd+Shift+F (macOS) 或 F11
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      settingsStore.toggleFocusMode();
    }
    
    // Esc 退出焦点模式
    if (e.key === 'Escape' && settingsStore.isFocusMode) {
      settingsStore.toggleFocusMode();
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
  
  // 移除图片粘贴警告监听
  window.removeEventListener('image-paste-warning', () => {});
});

// 监听原生菜单事件
let unlistenMenu: (() => void) | null = null;

onMounted(async () => {
  unlistenMenu = await listen('menu-event', (event) => {
    const action = event.payload as string;
    switch (action) {
      case 'new': handleNew(); break;
      case 'open': handleOpen(); break;
      case 'open_folder': handleOpenFolder(); break;
      case 'save': handleSave(); break;
      case 'save_as': handleSaveAs(); break;
      case 'export_html': exportHtml(); break;
      case 'export_pdf': exportPdf(); break;
      case 'export_wechat': copyToWechat(); break;
      case 'undo':
      case 'redo':
      case 'cut':
      case 'copy':
      case 'paste':
      case 'select_all':
        editorAction(action);
        break;
      case 'toggle_sidebar': toggleSidebar(); break;
      case 'sidebar_outline': sidebarMode.value = 'outline'; isSidebarOpen.value = true; break;
      case 'sidebar_files': sidebarMode.value = 'files'; isSidebarOpen.value = true; break;
      case 'toggle_source': toggleSourceMode(); break;
      case 'settings': settingsStore.openModal(); break;
      case 'find': editorRef.value?.openSearch(false); break;
      case 'replace': editorRef.value?.openSearch(true); break;
      case 'new_window': handleOpenNewWindow(); break;
      case 'focus_mode': settingsStore.toggleFocusMode(); break;
      case 'command_palette': isCommandPaletteOpen.value = true; break;
    }
  });
});

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

onMounted(async () => {
  unlistenOpenFile = await listen<string>('open-file-in-new-window', (event) => {
    const path = event.payload;
    handleOpenFile(path);
  });
});

onUnmounted(() => {
  if (unlistenOpenFile) unlistenOpenFile();
});

onUnmounted(() => {
  if (unlistenMenu) unlistenMenu();
});
</script>

<template>
  <div 
    class="h-screen flex flex-col bg-white overflow-hidden font-sans select-none"
    :class="{ 'focus-mode': settingsStore.isFocusMode }"
  >
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
          @scroll-to="scrollToHeading"
          @open-folder="handleOpenFolder"
          @open-file="handleOpenFile"
          @navigate-folder="handleNavigateFolder"
          @navigate-up="handleNavigateUp"
          @open-file-in-new-window="handleOpenNewWindow"
          @refresh-files="refreshFiles"
          @file-renamed="handleFileRenamed"
          @file-deleted="handleFileDeleted"
          @file-created="handleFileCreated"
        />
      </aside>

      <!-- 编辑器区域 -->
      <main 
        class="flex-1 relative overflow-hidden select-text"
        :class="{ 'focus-mode-editor': settingsStore.isFocusMode }"
      >
        <!-- 实时渲染模式 -->
        <MarkdownEditor
          v-if="!isSourceMode"
          :key="fileStore.currentFile.path || 'new-file'"
          ref="editorRef"
          :initial-content="fileStore.currentFile.content"
          @update="handleEditorUpdate"
        />
        
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

    <!-- 命令面板 -->
    <CommandPalette
      :visible="isCommandPaletteOpen"
      @close="isCommandPaletteOpen = false"
      @execute="handleCommandExecute"
    />
  </div>
</template>
