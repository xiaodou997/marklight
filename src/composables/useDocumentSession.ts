import { confirm, message, open, save } from '@tauri-apps/plugin-dialog';
import { onUnmounted, ref, watch } from 'vue';
import {
  openDocument,
  saveDocument,
  type DocumentOpenResult,
} from '../services/tauri/document';
import { normalizeTauriError } from '../services/tauri/client';
import type { WorkspaceChangedPayload } from '../services/tauri/events';
import { useFileStore } from '../stores/file';
import { useSettingsStore } from '../stores/settings';

export interface AutoSaveStatus {
  message: string;
  timestamp: number;
}

interface DocumentSessionOptions {
  resetViewMode: () => void;
}

export function useDocumentSession(options: DocumentSessionOptions) {
  const fileStore = useFileStore();
  const settingsStore = useSettingsStore();

  const autoSaveStatus = ref<AutoSaveStatus | null>(null);
  const externalFileWarning = ref<string | null>(null);

  let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;
  let autoSaveStatusTimer: ReturnType<typeof setTimeout> | null = null;
  let externalWarningTimer: ReturnType<typeof setTimeout> | null = null;

  async function loadDocumentFromPath(path: string): Promise<boolean> {
    try {
      fileStore.setLoading(true);
      const document = await openDocument(path);
      applyLoadedDocument(document);
      return true;
    } catch (error) {
      const { message: errorMessage } = normalizeTauriError(error);
      console.error('Failed to open document:', errorMessage);
      await message(`打开文件失败: ${errorMessage}`, { title: '错误', kind: 'error' });
      return false;
    } finally {
      fileStore.setLoading(false);
    }
  }

  function applyLoadedDocument(document: DocumentOpenResult) {
    fileStore.setFile(document.content, document.path, document.lastModifiedMs);
  }

  async function confirmDiscardUnsavedChanges() {
    if (!fileStore.currentFile.path && !fileStore.currentFile.content.trim()) {
      return true;
    }
    if (!fileStore.currentFile.isDirty) {
      return true;
    }

    return confirm('当前文件有未保存的更改，是否放弃更改？', {
      title: '未保存的更改',
      kind: 'warning',
    });
  }

  async function openDocumentWithPrompt(path: string) {
    if (!(await confirmDiscardUnsavedChanges())) {
      return false;
    }

    const loaded = await loadDocumentFromPath(path);
    if (loaded) {
      clearExternalWarning();
      options.resetViewMode();
    }
    return loaded;
  }

  async function handleNewDocument() {
    if (!(await confirmDiscardUnsavedChanges())) {
      return;
    }

    clearExternalWarning();
    fileStore.reset();
    options.resetViewMode();
  }

  async function handleOpenDocument() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (selected && typeof selected === 'string') {
      await openDocumentWithPrompt(selected);
    }
  }

  async function persistDocument(path: string, force: boolean, expectedLastModifiedMs?: number | null) {
    return saveDocument(path, fileStore.currentFile.content, expectedLastModifiedMs, force);
  }

  async function saveCurrentDocument(force = false): Promise<boolean> {
    const currentFile = fileStore.currentFile;
    if (!currentFile.path) {
      return saveCurrentDocumentAs();
    }

    try {
      const result = await persistDocument(
        currentFile.path,
        force,
        currentFile.lastModifiedTime,
      );
      fileStore.markSaved(result.lastModifiedMs);
      return true;
    } catch (error) {
      const appError = normalizeTauriError(error);
      if (appError.code === 'document_conflict' && !force) {
        const confirmed = await confirm('文件已被外部修改，是否强制覆盖？', {
          title: '检测到冲突',
          kind: 'warning',
        });
        if (!confirmed) {
          return false;
        }
        return saveCurrentDocument(true);
      }

      console.error('Failed to save document:', appError.message);
      await message(`保存失败: ${appError.message}`, { title: '错误', kind: 'error' });
      return false;
    }
  }

  async function saveCurrentDocumentAs(): Promise<boolean> {
    const selected = await save({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (!selected) {
      return false;
    }

    try {
      const result = await persistDocument(selected, true, null);
      fileStore.setFile(fileStore.currentFile.content, result.path, result.lastModifiedMs);
      fileStore.markSaved(result.lastModifiedMs);
      clearExternalWarning();
      return true;
    } catch (error) {
      const appError = normalizeTauriError(error);
      console.error('Failed to save document:', appError.message);
      await message(`保存失败: ${appError.message}`, { title: '错误', kind: 'error' });
      return false;
    }
  }

  function clearExternalWarning() {
    if (externalWarningTimer) {
      clearTimeout(externalWarningTimer);
      externalWarningTimer = null;
    }
    externalFileWarning.value = null;
  }

  function showExternalWarning(messageText: string) {
    clearExternalWarning();
    externalFileWarning.value = messageText;
    externalWarningTimer = setTimeout(() => {
      externalFileWarning.value = null;
      externalWarningTimer = null;
    }, 4000);
  }

  async function handleWorkspaceChange(payload: WorkspaceChangedPayload) {
    const currentPath = fileStore.currentFile.path;
    if (!currentPath || !payload.paths.includes(currentPath)) {
      return;
    }

    if (payload.kind === 'remove') {
      fileStore.reset();
      options.resetViewMode();
      showExternalWarning('当前文件已在外部被删除');
      return;
    }

    if (payload.kind !== 'modify' && payload.kind !== 'create') {
      return;
    }

    if (fileStore.currentFile.isDirty) {
      showExternalWarning('检测到外部修改，保存时会再次确认');
      return;
    }

    const loaded = await loadDocumentFromPath(currentPath);
    if (loaded) {
      showExternalWarning('已同步外部修改');
    }
  }

  function updateAutoSaveStatus(messageText: string) {
    if (autoSaveStatusTimer) {
      clearTimeout(autoSaveStatusTimer);
    }

    const timestamp = Date.now();
    autoSaveStatus.value = {
      message: messageText,
      timestamp,
    };
    autoSaveStatusTimer = setTimeout(() => {
      if (autoSaveStatus.value?.timestamp === timestamp) {
        autoSaveStatus.value = null;
      }
    }, 2000);
  }

  function stopAutoSave() {
    if (autoSaveIntervalId) {
      clearInterval(autoSaveIntervalId);
      autoSaveIntervalId = null;
    }
  }

  watch(
    () => [settingsStore.settings.autoSave, settingsStore.settings.autoSaveInterval] as const,
    ([enabled, intervalSeconds]) => {
      stopAutoSave();
      if (!enabled) {
        return;
      }

      autoSaveIntervalId = setInterval(async () => {
        if (!fileStore.currentFile.isDirty || !fileStore.currentFile.path) {
          return;
        }

        const saved = await saveCurrentDocument();
        if (saved) {
          updateAutoSaveStatus('已自动保存');
        }
      }, intervalSeconds * 1000);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stopAutoSave();
    if (autoSaveStatusTimer) {
      clearTimeout(autoSaveStatusTimer);
    }
    clearExternalWarning();
  });

  return {
    autoSaveStatus,
    externalFileWarning,
    loadDocumentFromPath,
    openDocumentWithPrompt,
    handleNewDocument,
    handleOpenDocument,
    saveCurrentDocument,
    saveCurrentDocumentAs,
    handleWorkspaceChange,
  };
}
