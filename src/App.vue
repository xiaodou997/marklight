<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from './stores/file';
import { useSettingsStore } from './stores/settings';
import { useFileOperations, type AutoSaveStatus } from './composables/useFileOperations';
import { useExportActions } from './composables/useExportActions';
import { useMenuEvents } from './composables/useMenuEvents';
import { useFileTree } from './composables/useFileTree';
import { useImagePreview } from './composables/useImagePreview';
import { useWindowEvents, confirmUnsavedChanges } from './composables/useWindowEvents';
import EditorToolbar from './components/Toolbar/EditorToolbar.vue';
import MarkdownEditor from './components/Editor/MarkdownEditor.vue';
import StatusBar from './components/Layout/StatusBar.vue';
import Sidebar, { OutlineItem } from './components/Editor/Sidebar.vue';
import SettingsModal from './components/Settings/SettingsModal.vue';
import ShortcutsModal from './components/Editor/ShortcutsModal.vue';
import CommandPalette from './components/Editor/CommandPalette.vue';
import TitleBar from './components/Layout/TitleBar.vue';
import { isModKey, isMac } from './utils/platform';
import { serializeMarkdown } from './components/Editor/core/markdown';
import pkg from '../package.json';

// --- Stores ---
const fileStore = useFileStore();
const settingsStore = useSettingsStore();

// --- Composables ---
const { handleNew, handleOpen, handleSave, handleSaveAs, setupAutoSave } = useFileOperations();
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null);
const appVersion = pkg.version;

const {
  activeViewMode, imagePreviewUrl, isFullscreenPreview,
  handleOpenImage, closeFullscreenPreview, resetToEditor
} = useImagePreview();

const { exportHtml, exportPdf, copyToWechat } = useExportActions({
  editorRef, activeViewMode, fileStore, settingsStore
});

const {
  files, currentFolder, pendingRenamePath,
  handleOpenFolder: fileTreeOpenFolder,
  handleNavigateFolder, handleNavigateUp, refreshFiles,
  handleFileRenamed, handleFileDeleted: fileTreeDeleteFile,
  handleFileCreated: fileTreeCreateFile,
  handleRenameCompleted, handleRevealInFinder,
  syncFolderFromFilePath, setupFileChangeListener,
  cleanup: cleanupFileTree
} = useFileTree();

// --- UI state ---
const isSidebarOpen = ref(true);
const isSourceMode = ref(false);
const sidebarMode = ref<'outline' | 'files'>('outline');
const autoSaveStatus = ref<AutoSaveStatus | null>(null);
const imagePasteWarning = ref<string | null>(null);
const isCommandPaletteOpen = ref(false);
const isShortcutsModalOpen = ref(false);

const stats = reactive({
  wordCount: 0,
  cursor: { line: 1, col: 1 },
  selectionText: ''
});
const outlineItems = ref<OutlineItem[]>([]);

// --- File operations wrappers ---
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

async function handleOpenFile(path: string) {
  if (!await checkUnsavedChanges()) return;
  try {
    const content = await invoke<string>('read_file', { path });
    fileStore.setFile(content, path);
    resetToEditor();
  } catch (error) {
    console.error('Failed to read file:', error);
  }
}

function handleOpenFolder() {
  fileTreeOpenFolder((mode) => { sidebarMode.value = mode; });
}

function handleFileDeletedWrapper(path: string) {
  fileTreeDeleteFile(path, () => { activeViewMode.value = 'editor'; });
}

function handleFileCreatedWrapper(name: string, isFolder: boolean) {
  fileTreeCreateFile(name, isFolder, handleOpenFile);
}

// --- Window events ---
const { setup: setupWindowEvents, cleanup: cleanupWindowEvents, appWindow } = useWindowEvents({
  handleOpenFile,
  handleSave,
  isDirty: () => fileStore.currentFile.isDirty,
});

// --- Editor helpers ---
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

function editorAction(_action: string) {
  if (!editorRef.value || activeViewMode.value !== 'editor') return;
  const view = (editorRef.value as any).getEditorView?.();
  if (!view) return;
  view.focus();
}

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

// --- Window title ---
function updateWindowTitle() {
  const file = fileStore.currentFile;
  let fileName = '未命名';
  if (activeViewMode.value === 'editor') {
    fileName = file.path ? file.path.split(/[/\\]/).pop() || '未命名' : '未命名';
  } else if (activeViewMode.value === 'image' && imagePreviewUrl.value) {
    fileName = '查看图片';
  }
  const title = file.isDirty ? `${fileName} ●` : fileName;
  appWindow.setTitle(title).catch(err => {
    if (!err.includes('window.set_title not allowed')) {
      console.error('Failed to set window title:', err);
    }
  });
}

// --- App-level actions ---
async function handleOpenNewWindow(path?: string) {
  await invoke('open_new_window', { path });
}

function showAbout() {
  message(`墨光 (MarkLight) v${appVersion}\n\n一款高性能、自研内核的 Markdown 编辑器\n\nGitHub: https://github.com/xiaodou997/marklight\nGitee: https://gitee.com/xiaodou997/marklight\n\n© 2026 luoxiaodou`, {
    title: '关于',
    kind: 'info'
  });
}

async function toggleFullscreen() {
  await appWindow.setFullscreen(!await appWindow.isFullscreen());
}

async function handleQuit() {
  if (fileStore.currentFile.isDirty) {
    const result = await confirmUnsavedChanges();
    if (result === 'cancel') return;
    if (result === 'save') {
      const saved = await handleSave();
      if (!saved) return;
    }
  }
  await appWindow.destroy();
}

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

// --- Image paste warning ---
const handleImagePasteWarning = (event: Event) => {
  const detail = (event as CustomEvent).detail as string | undefined;
  if (!detail) return;
  imagePasteWarning.value = detail;
  setTimeout(() => { imagePasteWarning.value = null; }, 3000);
};

// --- Watchers ---
watch(() => [fileStore.currentFile, activeViewMode.value, imagePreviewUrl.value], () => {
  if (fileStore.currentFile.path && activeViewMode.value === 'editor') {
    syncFolderFromFilePath(fileStore.currentFile.path);
  }
  updateWindowTitle();
}, { deep: true });

// --- Menu events ---
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

// --- Lifecycle ---
let cleanupAutoSave: (() => void) | null = null;

onMounted(async () => {
  updateWindowTitle();
  await settingsStore.init();
  document.addEventListener('copy', onCopy);

  cleanupAutoSave = setupAutoSave(autoSaveStatus);
  window.addEventListener('image-paste-warning', handleImagePasteWarning as EventListener);

  // 快捷键处理
  window.addEventListener('keydown', handleKeyDown);

  // 窗口事件
  await setupWindowEvents();
  await setupFileChangeListener();
});

function handleKeyDown(e: KeyboardEvent) {
  if (isModKey(e) && e.shiftKey && e.key === 'P') {
    e.preventDefault();
    isCommandPaletteOpen.value = true;
  }
  if (isModKey(e) && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    settingsStore.toggleFocusMode();
  }
  if (e.key === 'Escape') {
    if (isFullscreenPreview.value) {
      isFullscreenPreview.value = false;
    } else if (settingsStore.isFocusMode) {
      settingsStore.toggleFocusMode();
    }
  }
}

onUnmounted(() => {
  document.removeEventListener('copy', onCopy);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('image-paste-warning', handleImagePasteWarning as EventListener);
  cleanupAutoSave?.();
  cleanupFileTree();
  cleanupWindowEvents();
});
</script>

<template>
  <div
    class="h-screen flex flex-col overflow-hidden font-sans select-none"
    :class="{ 'focus-mode': settingsStore.isFocusMode }"
    style="background-color: var(--bg-color); color: var(--text-color);"
  >
    <!-- Windows/Linux 自定义标题栏 -->
    <TitleBar v-if="!isMac" />

    <!-- 工具栏 -->
    <div
      class="toolbar-container transition-opacity duration-300"
      :class="{ 'opacity-0 pointer-events-none': settingsStore.isFocusMode }"
    >
      <EditorToolbar
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
          @file-deleted="handleFileDeletedWrapper"
          @file-created="handleFileCreatedWrapper"
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
          class="h-full w-full flex items-center justify-center p-12 overflow-auto"
          style="background-color: var(--bg-color);"
        >
          <div class="relative group max-w-full max-h-full">
            <img
              :src="imagePreviewUrl"
              class="max-w-full max-h-full object-contain shadow-md rounded cursor-zoom-in"
              style="border: 1px solid var(--border-color); background-color: var(--bg-color);"
              title="双击全屏预览"
              @dblclick="isFullscreenPreview = true"
            />
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none">
              双击全屏查看
            </div>
          </div>
        </div>

        <!-- 源码模式 -->
        <div v-else class="h-full w-full p-8">
          <textarea
            class="w-full h-full resize-none outline-none font-mono text-sm leading-relaxed p-4 rounded-lg"
            style="color: var(--text-color); background-color: var(--sidebar-bg); border: 1px solid var(--border-color);"
            :value="fileStore.currentFile.content"
            @input="e => fileStore.setContent((e.target as HTMLTextAreaElement).value)"
            placeholder="在此输入 Markdown 源码..."
          ></textarea>
        </div>
      </main>
    </div>

    <!-- 状态栏 -->
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
