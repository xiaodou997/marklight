import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface FileState {
  path: string | null;
  content: string;
  isDirty: boolean;
}

export const useFileStore = defineStore('file', () => {
  const currentFile = ref<FileState>({
    path: null,
    content: '',
    isDirty: false,
  });

  function setContent(content: string) {
    if (currentFile.value.content !== content) {
      currentFile.value.content = content;
      currentFile.value.isDirty = true;
    }
  }

  function setFile(content: string, path: string | null) {
    currentFile.value = {
      path,
      content,
      isDirty: false,
    };
  }

  function markSaved() {
    currentFile.value.isDirty = false;
  }

  function reset() {
    currentFile.value = {
      path: null,
      content: '',
      isDirty: false,
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
