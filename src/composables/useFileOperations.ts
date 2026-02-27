import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../stores/file';

export function useFileOperations() {
  const fileStore = useFileStore();

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
        fileStore.setFile(content, selected);
      } catch (error) { 
        console.error('Failed to read file:', error); 
      }
    }
  }

  async function handleSave() {
    const file = fileStore.currentFile;
    if (file.path) {
      try {
        await invoke('save_file', { path: file.path, content: file.content });
        fileStore.markSaved();
      } catch (error) { 
        console.error('Failed to save file:', error); 
      }
    } else { 
      await handleSaveAs(); 
    }
  }

  async function handleSaveAs() {
    const selected = await save({ 
      filters: [{ name: 'Markdown', extensions: ['md'] }] 
    });
    if (selected) {
      try {
        await invoke('save_file', { path: selected, content: fileStore.currentFile.content });
        fileStore.setFile(fileStore.currentFile.content, selected);
        fileStore.markSaved();
      } catch (error) { 
        console.error('Failed to save file:', error); 
      }
    }
  }

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs
  };
}
