import { ref } from 'vue';
import { open, message } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useFileStore } from '../stores/file';
import { isMac } from '../utils/platform';
import type { FileInfo } from '../components/Editor/Sidebar.vue';

export function useFileTree() {
  const fileStore = useFileStore();

  const files = ref<FileInfo[]>([]);
  const currentFolder = ref<string | null>(null);
  const watchedFolder = ref<string | null>(null);
  const pendingRenamePath = ref<string | null>(null);

  let unlistenFileChanged: (() => void) | null = null;

  async function loadFiles(folderPath: string) {
    try {
      const result = await invoke<FileInfo[]>('list_directory', { path: folderPath });
      files.value = result;
      currentFolder.value = folderPath;
      if (watchedFolder.value && watchedFolder.value !== folderPath) {
        await invoke('unwatch_directory', { path: watchedFolder.value });
        watchedFolder.value = null;
      }
      if (watchedFolder.value !== folderPath) {
        await invoke('watch_directory', { path: folderPath });
        watchedFolder.value = folderPath;
      }
    } catch (error) {
      console.error('Failed to list directory:', error);
    }
  }

  async function handleOpenFolder(sidebarModeSetter: (mode: 'files') => void) {
    const selected = await open({
      directory: true,
      title: '选择文件夹'
    });
    if (selected && typeof selected === 'string') {
      await loadFiles(selected);
      sidebarModeSetter('files');
    }
  }

  async function handleNavigateFolder(path: string) {
    await loadFiles(path);
  }

  async function handleNavigateUp() {
    if (!currentFolder.value) return;
    const lastSlashIndex = Math.max(
      currentFolder.value.lastIndexOf('/'),
      currentFolder.value.lastIndexOf('\\')
    );
    if (lastSlashIndex !== -1) {
      const parentPath = currentFolder.value.substring(0, lastSlashIndex) || (isMac ? '/' : '');
      await loadFiles(parentPath);
    }
  }

  async function refreshFiles() {
    if (currentFolder.value) {
      await loadFiles(currentFolder.value);
    }
  }

  async function handleFileRenamed(oldPath: string, newName: string) {
    try {
      const newPath = await invoke<string>('rename_file', { oldPath, newName });
      await refreshFiles();
      if (fileStore.currentFile.path === oldPath) {
        fileStore.currentFile.path = newPath;
      }
    } catch (error) {
      await message(`重命名失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function handleFileDeleted(path: string, onCurrentFileDeleted: () => void) {
    try {
      await invoke('delete_file', { path });
      await refreshFiles();
      if (fileStore.currentFile.path === path) {
        fileStore.reset();
        onCurrentFileDeleted();
      }
    } catch (error) {
      await message(`删除失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function handleFileCreated(
    name: string,
    isFolder: boolean,
    openFile: (path: string) => void
  ) {
    if (!currentFolder.value) return;

    if (name === '__AUTO_RENAME__' && !isFolder) {
      await handleNewFileWithRename(openFile);
      return;
    }

    try {
      const path = await invoke<string>(
        isFolder ? 'create_folder' : 'create_file',
        { dir: currentFolder.value, name }
      );
      await refreshFiles();
      if (!isFolder) {
        openFile(path);
      }
    } catch (error) {
      await message(`创建失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function handleNewFileWithRename(openFile: (path: string) => void) {
    if (!currentFolder.value) return;
    const defaultName = '未命名.md';
    try {
      const path = await invoke<string>('create_file', {
        dir: currentFolder.value,
        name: defaultName
      });
      await refreshFiles();
      openFile(path);
      pendingRenamePath.value = path;
    } catch (error) {
      await message(`创建失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  function handleRenameCompleted() {
    pendingRenamePath.value = null;
  }

  async function handleRevealInFinder(path: string) {
    try {
      await invoke('reveal_in_finder', { path });
    } catch (error) {
      await message(`无法在文件管理器中显示: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  /** 当打开文件时，自动加载其所在文件夹 */
  function syncFolderFromFilePath(filePath: string | null) {
    if (!filePath) return;
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSlashIndex !== -1) {
      const folder = filePath.substring(0, lastSlashIndex);
      if (folder && folder !== currentFolder.value) {
        loadFiles(folder);
      }
    }
  }

  async function setupFileChangeListener() {
    unlistenFileChanged = await listen<{ kind: string; paths: string[] }>('file-changed', (event) => {
      const payload = event.payload;
      if (!currentFolder.value) return;

      // 只在变更路径属于当前文件夹时刷新
      if (payload && payload.paths && payload.paths.length > 0) {
        const relevant = payload.paths.some((p: string) => {
          const dir = p.substring(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')));
          return dir === currentFolder.value;
        });
        if (!relevant) return;
      }

      refreshFiles();
    });
  }

  function cleanup() {
    if (unlistenFileChanged) {
      unlistenFileChanged();
      unlistenFileChanged = null;
    }
    if (watchedFolder.value) {
      void invoke('unwatch_directory', { path: watchedFolder.value });
      watchedFolder.value = null;
    }
  }

  return {
    files,
    currentFolder,
    pendingRenamePath,
    loadFiles,
    handleOpenFolder,
    handleNavigateFolder,
    handleNavigateUp,
    refreshFiles,
    handleFileRenamed,
    handleFileDeleted,
    handleFileCreated,
    handleRenameCompleted,
    handleRevealInFinder,
    syncFolderFromFilePath,
    setupFileChangeListener,
    cleanup,
  };
}
