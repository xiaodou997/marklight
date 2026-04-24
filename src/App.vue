<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue';
import type { Node as PMNode } from '@tiptap/pm/model';
import { storeToRefs } from 'pinia';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import { useFileStore } from './stores/file';
import { useSettingsStore } from './stores/settings';
import { useFileOperations, type AutoSaveStatus } from './composables/useFileOperations';
import { useCommandDispatcher } from './composables/useCommandDispatcher';
import { useExportActions } from './composables/useExportActions';
import { useMenuShortcutsSync } from './composables/useMenuShortcutsSync';
import { useMenuEvents } from './composables/useMenuEvents';
import { useFileTree } from './composables/useFileTree';
import { useImagePreview } from './composables/useImagePreview';
import { useWindowEvents, confirmUnsavedChanges } from './composables/useWindowEvents';
import EditorToolbar from './components/Toolbar/EditorToolbar.vue';
import StatusBar from './components/Layout/StatusBar.vue';
import Sidebar, { type OutlineItem } from './components/Editor/Sidebar.vue';
import SettingsModal from './components/Settings/SettingsModal.vue';
import ShortcutsModal from './components/Editor/ShortcutsModal.vue';
import CommandPalette from './components/Editor/CommandPalette.vue';
import TitleBar from './components/Layout/TitleBar.vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { isMac } from './utils/platform';
import { findCommandByShortcut } from './utils/shortcuts';
import {
  destroyCurrentWindow,
  isCurrentWindowFullscreen,
  openNewAppWindow,
  setCurrentWindowFullscreen,
  setCurrentWindowTitle,
} from './services/tauri/window';
import { saveAllWindowState } from './services/tauri/window-state';
import type { FileChangePayload } from './services/tauri/file-system';
import pkg from '../package.json';

const MarkdownEditor = defineAsyncComponent(() => import('./components/Editor/MarkdownEditor.vue'));

// --- Stores ---
const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const { settings, isLoaded } = storeToRefs(settingsStore);

// --- Composables ---
const { loadFileFromPath, handleNew, handleOpen, handleSave, handleSaveAs, setupAutoSave } =
  useFileOperations();
type EditorExpose = {
  scrollToPos: (pos: number) => void;
  openSearch: (showReplace?: boolean) => void;
  getContent?: () => string;
  getDoc?: () => PMNode | null;
  getSelectionMarkdown?: () => string;
  getEditorView: () => any;
  hasFocus?: () => boolean;
  executeCommand?: (commandId: string) => boolean;
};
const editorRef = ref<EditorExpose | null>(null);
const appVersion = pkg.version;

const {
  activeViewMode,
  imagePreviewUrl,
  isFullscreenPreview,
  handleOpenImage,
  closeFullscreenPreview,
  resetToEditor,
} = useImagePreview();

const { exportHtml, exportPdf, copyToWechat } = useExportActions({
  editorRef,
  activeViewMode,
  fileStore,
  settingsStore,
});

const {
  rootFolder,
  treeNodes,
  flatFiles,
  pendingRenamePath,
  handleOpenFolder: fileTreeOpenFolder,
  toggleDir,
  refreshTree,
  handleFileRenamed,
  handleFileDeleted: fileTreeDeleteFile,
  handleFileCreated: fileTreeCreateFile,
  handleRenameCompleted,
  handleRevealInFinder,
  syncFolderFromFilePath,
  setupFileChangeListener,
  cleanup: cleanupFileTree,
} = useFileTree();

const { syncMenuShortcuts, stopWatching: stopWatchingMenuShortcuts } = useMenuShortcutsSync({
  customShortcuts: computed(() => settings.value.customShortcuts),
  isLoaded,
});

// --- UI state ---
const isSidebarOpen = ref(true);
const isSourceMode = ref(false);
const sidebarMode = ref<'outline' | 'files'>('outline');
const autoSaveStatus = ref<AutoSaveStatus | null>(null);
const imagePasteWarning = ref<string | null>(null);
const isCommandPaletteOpen = ref(false);
const isShortcutsModalOpen = ref(false);
const externalFileWarning = ref<string | null>(null);
let externalFileWarningTimer: ReturnType<typeof setTimeout> | null = null;

const stats = reactive({
  wordCount: 0,
  cursor: { line: 1, col: 1 },
  selectionText: '',
});
const outlineItems = ref<OutlineItem[]>([]);

// --- File operations wrappers ---
async function checkUnsavedChanges() {
  if (!fileStore.currentFile.path && !fileStore.currentFile.content.trim()) {
    return true;
  }
  if (fileStore.currentFile.isDirty) {
    const confirmed = await confirm('当前文件有未保存的更改，是否放弃更改？', {
      title: '未保存的更改',
      kind: 'warning',
    });
    return confirmed;
  }
  return true;
}

async function handleOpenFile(path: string) {
  if (!(await checkUnsavedChanges())) return;
  const loaded = await loadFileFromPath(path);
  if (loaded) {
    clearExternalFileWarning();
    resetToEditor();
  }
}

function handleOpenFolder() {
  fileTreeOpenFolder((mode) => {
    sidebarMode.value = mode;
  });
}

function handleFileDeletedWrapper(path: string) {
  fileTreeDeleteFile(path, () => {
    activeViewMode.value = 'editor';
  });
}

function clearExternalFileWarning() {
  if (externalFileWarningTimer) {
    clearTimeout(externalFileWarningTimer);
    externalFileWarningTimer = null;
  }
  externalFileWarning.value = null;
}

function showExternalFileWarning(message: string) {
  clearExternalFileWarning();
  externalFileWarning.value = message;
  externalFileWarningTimer = setTimeout(() => {
    externalFileWarning.value = null;
    externalFileWarningTimer = null;
  }, 4000);
}

async function handleRelevantFileChange(payload: FileChangePayload) {
  const currentPath = fileStore.currentFile.path;
  if (!currentPath || !payload.paths.includes(currentPath)) return;

  if (payload.kind === 'remove') {
    fileStore.reset();
    resetToEditor();
    showExternalFileWarning('当前文件已在外部被删除');
    return;
  }

  if (payload.kind !== 'modify' && payload.kind !== 'create') return;
  if (fileStore.currentFile.isDirty) {
    showExternalFileWarning('检测到外部修改，保存时会再次确认');
    return;
  }

  const loaded = await loadFileFromPath(currentPath);
  if (loaded) {
    showExternalFileWarning('已同步外部修改');
  }
}

function handleFileCreatedWrapper(name: string, isFolder: boolean) {
  if (!rootFolder.value) return;
  fileTreeCreateFile(name, isFolder, rootFolder.value, handleOpenFile);
}

// --- Window events ---
const { setup: setupWindowEvents, cleanup: cleanupWindowEvents } = useWindowEvents({
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

function onCopy(event: ClipboardEvent) {
  if (!editorRef.value || isSourceMode.value || activeViewMode.value !== 'editor') return;
  const view = editorRef.value.getEditorView?.();
  if (!view || !view.hasFocus()) return;
  const markdown = editorRef.value.getSelectionMarkdown?.() || '';
  if (!markdown) return;
  event.clipboardData?.setData('text/plain', markdown);
  event.preventDefault();
}

const windowTitle = computed(() => {
  const file = fileStore.currentFile;
  let fileName = '未命名';

  if (activeViewMode.value === 'editor') {
    fileName = file.path ? file.path.split(/[/\\]/).pop() || '未命名' : '未命名';
  } else if (activeViewMode.value === 'image' && imagePreviewUrl.value) {
    fileName = '查看图片';
  }

  return file.isDirty ? `${fileName} ●` : fileName;
});

function updateWindowTitle() {
  setCurrentWindowTitle(windowTitle.value).catch((err) => {
    if (!err.includes('window.set_title not allowed')) {
      console.error('Failed to set window title:', err);
    }
  });
}

// --- App-level actions ---
async function handleOpenNewWindow(path?: string) {
  await openNewAppWindow(path);
}

function showAbout() {
  message(
    `墨光 (MarkLight) v${appVersion}\n\n一款高性能、自研内核的 Markdown 编辑器\n\nGitHub: https://github.com/xiaodou997/marklight\nGitee: https://gitee.com/xiaodou997/marklight\n\n© 2026 luoxiaodou`,
    {
      title: '关于',
      kind: 'info',
    },
  );
}

async function toggleFullscreen() {
  await setCurrentWindowFullscreen(!(await isCurrentWindowFullscreen()));
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
  await saveAllWindowState().catch(() => {
    // Ignore window-state persistence failures and continue quitting.
  });
  await destroyCurrentWindow();
}

const { executeCommand } = useCommandDispatcher({
  editorRef,
  activeViewMode,
  isSourceMode,
  isSidebarOpen,
  sidebarMode,
  handleNew,
  handleOpen,
  handleOpenFolder,
  handleSave,
  handleSaveAs,
  handleOpenNewWindow,
  exportHtml,
  exportPdf,
  copyToWechat,
  toggleSidebar,
  toggleSourceMode,
  openSettings: () => settingsStore.openModal(),
  openCommandPalette: () => {
    isCommandPaletteOpen.value = true;
  },
  openShortcuts: () => {
    isShortcutsModalOpen.value = true;
  },
  toggleFocusMode: () => settingsStore.toggleFocusMode(),
  showAbout,
  toggleFullscreen,
  handleQuit,
});

// --- Image paste warning ---
const handleImagePasteWarning = (event: Event) => {
  const detail = (event as CustomEvent).detail as string | undefined;
  if (!detail) return;
  imagePasteWarning.value = detail;
  setTimeout(() => {
    imagePasteWarning.value = null;
  }, 3000);
};

// --- Watchers ---
watch(
  () => [fileStore.currentFile, activeViewMode.value, imagePreviewUrl.value],
  () => {
    if (fileStore.currentFile.path && activeViewMode.value === 'editor') {
      syncFolderFromFilePath(fileStore.currentFile.path);
    }
    updateWindowTitle();
  },
  { deep: true },
);

// --- Menu events ---
useMenuEvents(async (commandId) => {
  await executeCommand(commandId, 'menu');
});

// --- Lifecycle ---
let cleanupAutoSave: (() => void) | null = null;

// --- 阻止拖放文件导致 WebView 页面导航 ---
function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
}

// --- Tauri 原生拖放事件：处理 .md 文件拖入 ---
let unlistenDragDrop: (() => void) | null = null;

async function setupAppDragDrop() {
  const webview = getCurrentWebview();
  unlistenDragDrop = await webview.onDragDropEvent(async (event) => {
    if (event.payload.type !== 'drop') return;
    const paths = event.payload.paths;
    if (!paths?.length) return;
    // 找到第一个 Markdown 文件并打开
    const mdPath = paths.find((p) => /\.(md|markdown|txt)$/i.test(p));
    if (mdPath) {
      await handleOpenFile(mdPath);
    }
    // 图片文件的拖放由 MarkdownEditor 中的 onDragDropEvent 处理
  });
}

onMounted(async () => {
  updateWindowTitle();
  await settingsStore.init();
  document.addEventListener('copy', onCopy);
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('drop', handleDrop);
  await setupAppDragDrop();

  cleanupAutoSave = setupAutoSave(autoSaveStatus);
  window.addEventListener('image-paste-warning', handleImagePasteWarning as EventListener);

  // 快捷键处理
  window.addEventListener('keydown', handleKeyDown);

  // 窗口事件
  await setupWindowEvents();
  await setupFileChangeListener(handleRelevantFileChange);
  await syncMenuShortcuts();
});

async function handleKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (target?.closest('[data-shortcut-capture="true"]')) {
    return;
  }

  const command = findCommandByShortcut(e, settingsStore.settings.customShortcuts);
  if (command) {
    const handled = await executeCommand(command.id, 'shortcut');
    if (handled) {
      e.preventDefault();
      return;
    }
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
  document.removeEventListener('dragover', handleDragOver);
  document.removeEventListener('drop', handleDrop);
  unlistenDragDrop?.();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('image-paste-warning', handleImagePasteWarning as EventListener);
  clearExternalFileWarning();
  cleanupAutoSave?.();
  cleanupFileTree();
  cleanupWindowEvents();
  stopWatchingMenuShortcuts();
});
</script>

<template>
  <div
    class="h-screen flex flex-col overflow-hidden font-sans select-none"
    :class="{ 'focus-mode': settingsStore.isFocusMode }"
    style="background-color: var(--bg-color); color: var(--text-color)"
  >
    <TitleBar v-if="!isMac" />

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
      <aside
        v-show="isSidebarOpen && !isSourceMode && !settingsStore.isFocusMode"
        class="w-64 flex-shrink-0 transition-all duration-300"
      >
        <Sidebar
          v-model:mode="sidebarMode"
          :outline-items="outlineItems"
          :tree-nodes="treeNodes"
          :root-folder="rootFolder"
          :current-file-path="fileStore.currentFile.path"
          :pending-rename-path="pendingRenamePath"
          @scroll-to="scrollToHeading"
          @open-folder="handleOpenFolder"
          @open-file="handleOpenFile"
          @open-image="handleOpenImage"
          @toggle-dir="toggleDir"
          @open-file-in-new-window="handleOpenNewWindow"
          @refresh-files="refreshTree"
          @file-renamed="handleFileRenamed"
          @file-deleted="handleFileDeletedWrapper"
          @file-created="handleFileCreatedWrapper"
          @reveal-in-finder="handleRevealInFinder"
          @rename-completed="handleRenameCompleted"
        />
      </aside>

      <main
        class="flex-1 relative overflow-hidden select-text"
        :class="{ 'focus-mode-editor': settingsStore.isFocusMode }"
      >
        <MarkdownEditor
          v-if="activeViewMode === 'editor' && !isSourceMode"
          :key="fileStore.currentFile.path || 'new-file'"
          ref="editorRef"
          :initial-content="fileStore.currentFile.content"
          @update="handleEditorUpdate"
        />

        <div
          v-else-if="activeViewMode === 'image' && imagePreviewUrl"
          class="h-full w-full flex items-center justify-center p-12 overflow-auto"
          style="background-color: var(--bg-color)"
        >
          <div class="relative group max-w-full max-h-full">
            <img
              :src="imagePreviewUrl"
              class="max-w-full max-h-full object-contain shadow-md rounded cursor-zoom-in"
              style="border: 1px solid var(--border-color); background-color: var(--bg-color)"
              title="双击全屏预览"
              @dblclick="isFullscreenPreview = true"
            />
            <div
              class="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none"
            >
              双击全屏查看
            </div>
          </div>
        </div>

        <div v-else class="h-full w-full p-8">
          <textarea
            class="w-full h-full resize-none outline-none font-mono text-sm leading-relaxed p-4 rounded-lg"
            style="
              color: var(--text-color);
              background-color: var(--sidebar-bg);
              border: 1px solid var(--border-color);
            "
            :value="fileStore.currentFile.content"
            @input="(e) => fileStore.setContent((e.target as HTMLTextAreaElement).value)"
            placeholder="在此输入 Markdown 源码..."
          ></textarea>
        </div>
      </main>
    </div>

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
        :external-file-warning="externalFileWarning"
      />
    </div>

    <SettingsModal />

    <ShortcutsModal :visible="isShortcutsModalOpen" @close="isShortcutsModalOpen = false" />

    <CommandPalette
      :visible="isCommandPaletteOpen"
      :files="flatFiles"
      :current-folder="rootFolder"
      @close="isCommandPaletteOpen = false"
      @execute="(command) => executeCommand(command.id, 'palette')"
      @open-file="handleOpenFile"
    />

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isFullscreenPreview && imagePreviewUrl"
          class="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 cursor-zoom-out"
          @click="closeFullscreenPreview"
        >
          <img :src="imagePreviewUrl" class="max-w-full max-h-full object-contain" @click.stop />
          <button
            class="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            @click="closeFullscreenPreview"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
