import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { watch, type Ref } from 'vue';
import { useFileStore } from '../stores/file';
import { useSettingsStore } from '../stores/settings';

export interface AutoSaveStatus {
  message: string;
  timestamp: number;
}

export function useFileOperations() {
  const fileStore = useFileStore();
  const settingsStore = useSettingsStore();

  async function handleNew() {
    if (fileStore.currentFile.isDirty) {
      const confirm = await window.confirm('当前更改尚未保存，确定要新建吗？');
      if (!confirm) return;
    }
    fileStore.reset();
  }

  async function handleOpen() {
    const selected = await open({ 
      multiple: false, 
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }] 
    });
    if (selected && typeof selected === 'string') {
      try {
        const content = await invoke<string>('read_file', { path: selected });
        const mtime = await invoke<number>('get_file_modified_time', { path: selected });
        fileStore.setFile(content, selected, mtime);
      } catch (error) { 
        console.error('Failed to read file:', error); 
      }
    }
  }

  async function handleSave() {
    const file = fileStore.currentFile;
    if (file.path) {
      try {
        // 检测冲突
        if (file.lastModifiedTime) {
          const currentMtime = await invoke<number>('get_file_modified_time', { path: file.path });
          if (currentMtime > file.lastModifiedTime) {
            const confirmed = await window.confirm('文件已被外部程序修改，是否覆盖？');
            if (!confirmed) return false;
          }
        }

        await invoke('save_file', { path: file.path, content: file.content });
        const newMtime = await invoke<number>('get_file_modified_time', { path: file.path });
        fileStore.markSaved(newMtime);
        return true;
      } catch (error) { 
        console.error('Failed to save file:', error); 
        return false;
      }
    } else { 
      await handleSaveAs();
      return true;
    }
    return false;
  }

  async function handleSaveAs() {
    const selected = await save({ 
      filters: [{ name: 'Markdown', extensions: ['md'] }] 
    });
    if (selected) {
      try {
        await invoke('save_file', { path: selected, content: fileStore.currentFile.content });
        const newMtime = await invoke<number>('get_file_modified_time', { path: selected });
        fileStore.setFile(fileStore.currentFile.content, selected, newMtime);
        fileStore.markSaved(newMtime);
      } catch (error) { 
        console.error('Failed to save file:', error); 
      }
    }
  }

  /**
   * 设置自动保存
   * @param autoSaveStatusRef 用于传递自动保存状态的 ref
   */
  function setupAutoSave(autoSaveStatusRef: Ref<AutoSaveStatus | null>) {
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;

    // 监听 isDirty 变化
    const stopWatch = watch(
      () => fileStore.currentFile.isDirty,
      (isDirty) => {
        // 清除之前的定时器
        if (saveTimeout) {
          clearTimeout(saveTimeout);
          saveTimeout = null;
        }

        // 如果 isDirty 为 true 且设置了自动保存
        if (isDirty && settingsStore.settings.autoSave) {
          const interval = settingsStore.settings.autoSaveInterval * 1000;
          
          saveTimeout = setTimeout(async () => {
            // 再次检查条件（可能在等待期间发生了变化）
            if (!fileStore.currentFile.isDirty || !fileStore.currentFile.path) {
              return;
            }

            const success = await handleSave();
            if (success) {
              // 设置自动保存状态，供状态栏显示
              autoSaveStatusRef.value = {
                message: '已自动保存',
                timestamp: Date.now()
              };
              
              // 2秒后清除提示
              setTimeout(() => {
                if (autoSaveStatusRef.value?.timestamp === Date.now()) {
                  autoSaveStatusRef.value = null;
                }
              }, 2000);
            }
          }, interval);
        }
      },
      { immediate: false }
    );

    // 返回清理函数
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      stopWatch();
    };
  }

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    setupAutoSave
  };
}
