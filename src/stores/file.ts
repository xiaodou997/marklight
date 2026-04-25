import { defineStore } from 'pinia';

export interface FileState {
  path: string | null;
  content: string;
  isDirty: boolean;
  lastModifiedTime: number | null;
}

interface FileStoreState {
  currentFile: FileState;
  hasUserEdit: boolean;
  isLoading: boolean;
}

function createEmptyFileState(): FileState {
  return {
    path: null,
    content: '',
    isDirty: false,
    lastModifiedTime: null,
  };
}

export const useFileStore = defineStore('file', {
  state: (): FileStoreState => ({
    currentFile: createEmptyFileState(),
    // 标记用户是否有过编辑操作
    hasUserEdit: false,
    isLoading: false,
  }),

  actions: {
    setLoading(loading: boolean) {
      this.isLoading = loading;
    },

    setContent(content: string) {
      this.currentFile.content = content;
      // 只有用户有编辑操作时才标记为脏
      if (this.hasUserEdit) {
        this.currentFile.isDirty = true;
      }
    },

    // 用户编辑操作时调用
    markUserEdit() {
      this.hasUserEdit = true;
      this.currentFile.isDirty = true;
    },

    setFile(content: string, path: string | null, lastModifiedTime: number | null = null) {
      this.currentFile = {
        path,
        content,
        isDirty: false,
        lastModifiedTime,
      };
      // 重置编辑标志
      this.hasUserEdit = false;
    },

    markSaved(lastModifiedTime: number | null = null) {
      this.currentFile.isDirty = false;
      this.hasUserEdit = false;
      if (lastModifiedTime !== null) {
        this.currentFile.lastModifiedTime = lastModifiedTime;
      }
    },

    reset() {
      this.currentFile = createEmptyFileState();
      this.hasUserEdit = false;
    },
  },
});
