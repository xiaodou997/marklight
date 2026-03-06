import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface FileState {
  path: string | null;
  content: string;
  isDirty: boolean;
  lastModifiedTime: number | null;
}

export const useFileStore = defineStore('file', () => {
  const currentFile = ref<FileState>({
    path: null,
    content: '',
    isDirty: false,
    lastModifiedTime: null,
  });

  function setContent(content: string) {
    if (currentFile.value.content !== content) {
      currentFile.value.content = content;
      currentFile.value.isDirty = true;
    }
  }

  function setFile(content: string, path: string | null, lastModifiedTime: number | null = null) {
    currentFile.value = {
      path,
      content,
      isDirty: false,
      lastModifiedTime,
    };
  }

  function markSaved(lastModifiedTime: number | null = null) {
    currentFile.value.isDirty = false;
    if (lastModifiedTime !== null) {
      currentFile.value.lastModifiedTime = lastModifiedTime;
    }
  }

  function reset() {
    currentFile.value = {
      path: null,
      content: '',
      isDirty: false,
      lastModifiedTime: null,
    };
  }

  return {
    currentFile,
    setContent,
    setFile,
    markSaved,
    reset,
  };
});
