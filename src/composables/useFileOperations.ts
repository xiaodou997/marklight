import { open, save, confirm } from '@tauri-apps/plugin-dialog';
import { watch, type Ref } from 'vue';
import {
  getDocumentModifiedTime,
  readDocumentFile,
  saveDocumentFile,
} from '../services/tauri/file-system';
import { useFileStore } from '../stores/file';
import { useSettingsStore } from '../stores/settings';

export interface AutoSaveStatus {
  message: string;
  timestamp: number;
}

export function useFileOperations() {
  const fileStore = useFileStore();
  const settingsStore = useSettingsStore();

  async function loadFileFromPath(path: string): Promise<boolean> {
    try {
      fileStore.setLoading(true);
      const [content, mtime] = await Promise.all([
        readDocumentFile(path),
        getDocumentModifiedTime(path),
      ]);
      fileStore.setFile(content, path, mtime);
      return true;
    } catch (error) {
      console.error('Failed to read file:', error);
      return false;
    } finally {
      fileStore.setLoading(false);
    }
  }

  async function handleNew() {
    if (fileStore.currentFile.isDirty) {
      const confirmed = await confirm('当前更改尚未保存，确定要新建吗？', {
        title: '未保存的更改',
        kind: 'warning',
      });
      if (!confirmed) return;
    }
    fileStore.reset();
  }

  async function handleOpen() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (selected && typeof selected === 'string') {
      await loadFileFromPath(selected);
    }
  }

  async function handleSave(): Promise<boolean> {
    const file = fileStore.currentFile;
    if (file.path) {
      try {
        // 检测冲突
        if (file.lastModifiedTime) {
          const currentMtime = await getDocumentModifiedTime(file.path);
          if (currentMtime > file.lastModifiedTime) {
            const confirmed = await confirm('文件已被外部程序修改，是否覆盖？', {
              title: '检测到冲突',
              kind: 'warning',
            });
            if (!confirmed) return false;
          }
        }

        await saveDocumentFile(file.path, file.content);
        const newMtime = await getDocumentModifiedTime(file.path);
        fileStore.markSaved(newMtime);
        return true;
      } catch (error) {
        console.error('Failed to save file:', error);
        return false;
      }
    } else {
      return await handleSaveAs();
    }
  }

  async function handleSaveAs(): Promise<boolean> {
    const selected = await save({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (selected) {
      try {
        await saveDocumentFile(selected, fileStore.currentFile.content);
        const newMtime = await getDocumentModifiedTime(selected);
        fileStore.setFile(fileStore.currentFile.content, selected, newMtime);
        fileStore.markSaved(newMtime);
        return true;
      } catch (error) {
        console.error('Failed to save file:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 设置自动保存
   * 使用 setInterval 周期性检查，避免 watch isDirty 只触发一次的问题
   */
  function setupAutoSave(autoSaveStatusRef: Ref<AutoSaveStatus | null>) {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isSaving = false;

    function startInterval() {
      stopInterval();
      const interval = settingsStore.settings.autoSaveInterval * 1000;
      intervalId = setInterval(async () => {
        if (isSaving) return;
        if (!settingsStore.settings.autoSave) return;
        if (!fileStore.currentFile.isDirty || !fileStore.currentFile.path) return;

        isSaving = true;
        try {
          const success = await handleSave();
          if (success) {
            const ts = Date.now();
            autoSaveStatusRef.value = { message: '已自动保存', timestamp: ts };
            setTimeout(() => {
              if (autoSaveStatusRef.value?.timestamp === ts) {
                autoSaveStatusRef.value = null;
              }
            }, 2000);
          }
        } finally {
          isSaving = false;
        }
      }, interval);
    }

    function stopInterval() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    // 监听自动保存设置变化，动态启停
    const stopWatch = watch(
      () => [settingsStore.settings.autoSave, settingsStore.settings.autoSaveInterval] as const,
      ([enabled]) => {
        if (enabled) {
          startInterval();
        } else {
          stopInterval();
        }
      },
      { immediate: true },
    );

    return () => {
      stopInterval();
      stopWatch();
    };
  }

  return {
    loadFileFromPath,
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    setupAutoSave,
  };
}
