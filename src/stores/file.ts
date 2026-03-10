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

  // 标记用户是否有过编辑操作
  const hasUserEdit = ref(false);

  const isLoading = ref(false);

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setContent(content: string) {
    currentFile.value.content = content;
    // 只有用户有编辑操作时才标记为脏
    if (hasUserEdit.value) {
      currentFile.value.isDirty = true;
    }
  }

  // 用户编辑操作时调用
  function markUserEdit() {
    hasUserEdit.value = true;
    currentFile.value.isDirty = true;
  }

  function setFile(content: string, path: string | null, lastModifiedTime: number | null = null) {
    currentFile.value = {
      path,
      content,
      isDirty: false,
      lastModifiedTime,
    };
    // 重置编辑标志
    hasUserEdit.value = false;
  }

  function markSaved(lastModifiedTime: number | null = null) {
    currentFile.value.isDirty = false;
    hasUserEdit.value = false;
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
    hasUserEdit.value = false;
  }

  return {
    currentFile,
    isLoading,
    setLoading,
    setContent,
    markUserEdit,
    setFile,
    markSaved,
    reset,
  };
});
