<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { storeToRefs } from 'pinia';
import { message } from '@tauri-apps/plugin-dialog';
import { useAppWindowSession } from './composables/useAppWindowSession';
import { useCommandDispatcher } from './composables/useCommandDispatcher';
import { useDocumentSession } from './composables/useDocumentSession';
import { useExportActions } from './composables/useExportActions';
import { useImagePreview } from './composables/useImagePreview';
import { useMenuEvents } from './composables/useMenuEvents';
import { useMenuShortcutsSync } from './composables/useMenuShortcutsSync';
import { useWorkspaceSession } from './composables/useWorkspaceSession';
import CommandPalette from './components/Editor/CommandPalette.vue';
import ShortcutsModal from './components/Editor/ShortcutsModal.vue';
import Sidebar, { type OutlineItem } from './components/Editor/Sidebar.vue';
import StatusBar from './components/Layout/StatusBar.vue';
import TitleBar from './components/Layout/TitleBar.vue';
import SettingsModal from './components/Settings/SettingsModal.vue';
import EditorToolbar from './components/Toolbar/EditorToolbar.vue';
import { useFileStore } from './stores/file';
import { useSettingsStore } from './stores/settings';
import { findCommandByShortcut } from './utils/shortcuts';
import { isMac } from './utils/platform';
import pkg from '../package.json';

const MarkdownEditor = defineAsyncComponent(() => import('./components/Editor/MarkdownEditor.vue'));

type EditorExpose = {
  scrollToPos: (pos: number) => void;
  openSearch: (showReplace?: boolean) => void;
  getContent?: () => string;
  getDoc?: () => PMNode | null;
  getSelectionMarkdown?: () => string;
  getEditorView: () => EditorView | null;
  hasFocus?: () => boolean;
  executeCommand?: (commandId: string) => boolean;
};

type EditorUpdatePayload = {
  wordCount?: number;
  cursor?: { line: number; col: number };
  selectionText?: string;
  outline?: OutlineItem[];
};

const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const { settings, isLoaded } = storeToRefs(settingsStore);
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

const documentSession = useDocumentSession({
  resetViewMode: resetToEditor,
});

async function handleOpenFile(path: string) {
  await documentSession.openDocumentWithPrompt(path);
}

const workspaceSession = useWorkspaceSession({
  openDocument: handleOpenFile,
  onCurrentDocumentDeleted: resetToEditor,
  onWorkspaceChanged: documentSession.handleWorkspaceChange,
});
const {
  rootFolder,
  treeNodes,
  flatFiles,
  pendingRenamePath,
  toggleDir,
  refreshTree,
  renameEntry: handleFileRenamed,
  deleteEntry: handleFileDeletedWrapper,
  handleRenameCompleted,
  revealInFinder: handleRevealInFinder,
} = workspaceSession;
const { autoSaveStatus, externalFileWarning } = documentSession;

const { exportHtml, exportPdf, copyToWechat } = useExportActions({
  editorRef,
  activeViewMode,
  fileStore,
  settingsStore,
});

const { syncMenuShortcuts, stopWatching: stopWatchingMenuShortcuts } = useMenuShortcutsSync({
  customShortcuts: computed(() => settings.value.customShortcuts),
  isLoaded,
});

const isSidebarOpen = ref(true);
const isSourceMode = ref(false);
const sidebarMode = ref<'outline' | 'files'>('outline');
const imagePasteWarning = ref<string | null>(null);
const isCommandPaletteOpen = ref(false);
const isShortcutsModalOpen = ref(false);

const stats = reactive({
  wordCount: 0,
  cursor: { line: 1, col: 1 },
  selectionText: '',
});
const outlineItems = ref<OutlineItem[]>([]);

function handleEditorUpdate(data: EditorUpdatePayload) {
  if (data.wordCount !== undefined) stats.wordCount = data.wordCount;
  if (data.cursor) stats.cursor = data.cursor;
  if (data.selectionText !== undefined) stats.selectionText = data.selectionText;
  if (data.outline) outlineItems.value = data.outline;
}

function scrollToHeading(pos: number) {
  editorRef.value?.scrollToPos(pos);
}

async function handleOpenFolder() {
  const opened = await workspaceSession.openWorkspacePicker();
  if (opened) {
    sidebarMode.value = 'files';
  }
}

async function handleOpenNewWindow(path?: string) {
  await windowSession.handleOpenEditorWindow(path);
}

function handleFileCreatedWrapper(name: string, isFolder: boolean) {
  void workspaceSession.createEntry(name, isFolder);
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

const windowSession = useAppWindowSession({
  openDocument: handleOpenFile,
  saveDocument: documentSession.saveCurrentDocument,
  isDirty: () => fileStore.currentFile.isDirty,
  windowTitle,
});

function showAbout() {
  message(
    `墨光 (MarkLight) v${appVersion}\n\n一款高性能、自研内核的 Markdown 编辑器\n\nGitHub: https://github.com/xiaodou997/marklight\nGitee: https://gitee.com/xiaodou997/marklight\n\n© 2026 luoxiaodou`,
    {
      title: '关于',
      kind: 'info',
    },
  );
}

const { executeCommand } = useCommandDispatcher({
  editorRef,
  activeViewMode,
  isSourceMode,
  isSidebarOpen,
  sidebarMode,
  handleNew: documentSession.handleNewDocument,
  handleOpen: documentSession.handleOpenDocument,
  handleOpenFolder,
  handleSave: documentSession.saveCurrentDocument,
  handleSaveAs: documentSession.saveCurrentDocumentAs,
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
  toggleFullscreen: windowSession.toggleFullscreen,
  handleQuit: windowSession.handleQuit,
});

const handleImagePasteWarning = (event: Event) => {
  const detail = (event as CustomEvent).detail as string | undefined;
  if (!detail) return;
  imagePasteWarning.value = detail;
  setTimeout(() => {
    imagePasteWarning.value = null;
  }, 3000);
};

watch(
  () => [fileStore.currentFile.path, activeViewMode.value] as const,
  ([path, viewMode]) => {
    if (path && viewMode === 'editor') {
      workspaceSession.syncWorkspaceFromDocumentPath(path);
    }
  },
  { immediate: true },
);

useMenuEvents(async (commandId) => {
  await executeCommand(commandId, 'menu');
});

onMounted(async () => {
  await settingsStore.init();
  document.addEventListener('copy', onCopy);
  window.addEventListener('image-paste-warning', handleImagePasteWarning as EventListener);
  window.addEventListener('keydown', handleKeyDown);
  await workspaceSession.setup();
  await windowSession.setup();
  await syncMenuShortcuts();
});

async function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('[data-shortcut-capture="true"]')) {
    return;
  }

  const command = findCommandByShortcut(event, settingsStore.settings.customShortcuts);
  if (command) {
    if (
      target?.closest('.tiptap-editor')
      && (command.id === 'editor.undo' || command.id === 'editor.redo')
    ) {
      return;
    }

    const handled = await executeCommand(command.id, 'shortcut');
    if (handled) {
      event.preventDefault();
      return;
    }
  }

  if (event.key === 'Escape') {
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
  workspaceSession.cleanup();
  windowSession.cleanup();
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
        @new-file="documentSession.handleNewDocument"
        @open-file="documentSession.handleOpenDocument"
        @save-file="documentSession.saveCurrentDocument"
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
            placeholder="在此输入 Markdown 源码..."
            @input="(e) => fileStore.setContent((e.target as HTMLTextAreaElement).value)"
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
