<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppWindowSession } from './composables/useAppWindowSession';
import { useCommandDispatcher } from './composables/useCommandDispatcher';
import { useAppDomEvents } from './composables/useAppDomEvents';
import { useAppEditorState } from './composables/useAppEditorState';
import { useAppUiState } from './composables/useAppUiState';
import { useDocumentSession } from './composables/useDocumentSession';
import { useExportActions } from './composables/useExportActions';
import { useImagePreview } from './composables/useImagePreview';
import { useMenuEvents } from './composables/useMenuEvents';
import { useMenuShortcutsSync } from './composables/useMenuShortcutsSync';
import { useWorkspaceSession } from './composables/useWorkspaceSession';
import CommandPalette from './components/Editor/CommandPalette.vue';
import ImageFullscreenOverlay from './components/Editor/ImageFullscreenOverlay.vue';
import ImagePreviewView from './components/Editor/ImagePreviewView.vue';
import ShortcutsModal from './components/Editor/ShortcutsModal.vue';
import Sidebar from './components/Editor/Sidebar.vue';
import SourceEditorView from './components/Editor/SourceEditorView.vue';
import StatusBar from './components/Layout/StatusBar.vue';
import TitleBar from './components/Layout/TitleBar.vue';
import SettingsModal from './components/Settings/SettingsModal.vue';
import EditorToolbar from './components/Toolbar/EditorToolbar.vue';
import { useFileStore } from './stores/file';
import { useSettingsStore } from './stores/settings';
import { message } from './services/tauri/dialog';
import { findCommandByShortcut } from './utils/shortcuts';
import { isMac } from './utils/platform';
import pkg from '../package.json';

const MarkdownEditor = defineAsyncComponent(() => import('./components/Editor/MarkdownEditor.vue'));

const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const { settings, isLoaded } = storeToRefs(settingsStore);
const appVersion = pkg.version;
const { editorRef, stats, outlineItems, handleEditorUpdate, scrollToHeading } =
  useAppEditorState();

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

const {
  isSidebarOpen,
  isSourceMode,
  sidebarMode,
  imagePasteWarning,
  isCommandPaletteOpen,
  isShortcutsModalOpen,
  toggleSidebar,
  toggleSourceMode,
  openCommandPalette,
  openShortcutsModal,
  showImagePasteWarning,
} = useAppUiState();

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
  openCommandPalette,
  openShortcuts: openShortcutsModal,
  toggleFocusMode: () => settingsStore.toggleFocusMode(),
  showAbout,
  toggleFullscreen: windowSession.toggleFullscreen,
  handleQuit: windowSession.handleQuit,
});

useAppDomEvents({
  editorRef,
  activeViewMode,
  isSourceMode,
  isFullscreenPreview,
  isFocusMode: () => settingsStore.isFocusMode,
  customShortcuts: () => settingsStore.settings.customShortcuts,
  findCommandByShortcut,
  executeCommand,
  clearFullscreenPreview: () => {
    isFullscreenPreview.value = false;
  },
  toggleFocusMode: () => settingsStore.toggleFocusMode(),
  showImagePasteWarning,
});

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
  await workspaceSession.setup();
  await windowSession.setup();
  await syncMenuShortcuts();
});

onUnmounted(() => {
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

        <ImagePreviewView
          v-else-if="activeViewMode === 'image' && imagePreviewUrl"
          :image-url="imagePreviewUrl"
          @open-fullscreen="isFullscreenPreview = true"
        />

        <SourceEditorView
          v-else
          :content="fileStore.currentFile.content"
          @update-content="fileStore.setContent"
        />
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

    <ImageFullscreenOverlay
      :visible="isFullscreenPreview && Boolean(imagePreviewUrl)"
      :image-url="imagePreviewUrl || ''"
      @close="closeFullscreenPreview"
    />
  </div>
</template>
