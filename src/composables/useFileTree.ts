import { ref, computed } from 'vue';
import { open, message } from '@tauri-apps/plugin-dialog';
import {
  createFileEntry,
  createFolderEntry,
  deleteFileEntry,
  listSupportedDirectory,
  renameFileEntry,
  revealPathInFinder,
  unwatchDirectoryPath,
  watchDirectoryPath,
  type FileChangePayload,
  type NativeFileInfo,
} from '../services/tauri/file-system';
import { listenFileChanged } from '../services/tauri/events';
import { useFileStore } from '../stores/file';

export interface TreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  is_md: boolean;
  is_txt: boolean;
  is_image: boolean;
  expanded: boolean;
  children: TreeNode[] | null; // null = not yet loaded
}

function fileInfoToNode(info: NativeFileInfo): TreeNode {
  return { ...info, expanded: false, children: info.is_dir ? null : [] };
}

export function normalizeWatchPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
}

export function isPathInTreeRoot(path: string, rootPath: string): boolean {
  const normalizedPath = normalizeWatchPath(path);
  const normalizedRootPath = normalizeWatchPath(rootPath);
  return (
    normalizedPath === normalizedRootPath || normalizedPath.startsWith(`${normalizedRootPath}/`)
  );
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.is_dir && node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** 合并新旧列表，保留已展开目录的子树 */
function mergeChildren(newInfos: NativeFileInfo[], oldNodes: TreeNode[]): TreeNode[] {
  const oldMap = new Map(oldNodes.map((n) => [n.path, n]));
  return newInfos.map((info) => {
    const old = oldMap.get(info.path);
    if (old && old.is_dir) {
      return { ...fileInfoToNode(info), expanded: old.expanded, children: old.children };
    }
    return fileInfoToNode(info);
  });
}

/** 递归刷新所有已展开的目录 */
async function refreshExpandedNodes(nodes: TreeNode[]): Promise<void> {
  for (const node of nodes) {
    if (node.is_dir && node.expanded) {
      const result = await listSupportedDirectory(node.path).catch(() => null);
      if (result) {
        node.children = mergeChildren(result, node.children ?? []);
        await refreshExpandedNodes(node.children);
      }
    }
  }
}

export function useFileTree() {
  const fileStore = useFileStore();

  const rootFolder = ref<string | null>(null);
  const treeNodes = ref<TreeNode[]>([]);
  const pendingRenamePath = ref<string | null>(null);
  const watchedFolder = ref<string | null>(null);

  let unlistenFileChanged: (() => void) | null = null;

  /** 所有节点展平（用于搜索、CommandPalette 等） */
  const flatAllNodes = computed(() => {
    const result: TreeNode[] = [];
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        result.push(n);
        if (n.is_dir && n.children) collect(n.children);
      }
    }
    collect(treeNodes.value);
    return result;
  });

  /** 仅文件（非目录），用于 CommandPalette */
  const flatFiles = computed(() => flatAllNodes.value.filter((n) => !n.is_dir));

  async function loadRootFolder(path: string) {
    try {
      const result = await listSupportedDirectory(path);
      rootFolder.value = path;
      treeNodes.value = result.map(fileInfoToNode);

      // 切换监听目录
      if (watchedFolder.value && watchedFolder.value !== path) {
        await unwatchDirectoryPath(watchedFolder.value);
      }
      if (watchedFolder.value !== path) {
        await watchDirectoryPath(path);
        watchedFolder.value = path;
      }
    } catch (error) {
      console.error('Failed to list directory:', error);
    }
  }

  async function handleOpenFolder(sidebarModeSetter: (mode: 'files') => void) {
    const selected = await open({ directory: true, title: '选择文件夹' });
    if (selected && typeof selected === 'string') {
      await loadRootFolder(selected);
      sidebarModeSetter('files');
    }
  }

  /** 展开或折叠目录节点 */
  async function toggleDir(path: string) {
    const node = findNode(treeNodes.value, path);
    if (!node || !node.is_dir) return;

    if (node.expanded) {
      node.expanded = false;
    } else {
      // 首次展开时加载子节点
      if (node.children === null) {
        const result = await listSupportedDirectory(node.path).catch(() => []);
        node.children = result.map(fileInfoToNode);
      }
      node.expanded = true;
    }
  }

  /** 刷新整棵树（保留展开状态） */
  async function refreshTree() {
    if (!rootFolder.value) return;
    const result = await listSupportedDirectory(rootFolder.value).catch(() => null);
    if (result) {
      treeNodes.value = mergeChildren(result, treeNodes.value);
      await refreshExpandedNodes(treeNodes.value);
    }
  }

  async function handleFileRenamed(oldPath: string, newName: string) {
    try {
      const newPath = await renameFileEntry(oldPath, newName);
      await refreshTree();
      if (fileStore.currentFile.path === oldPath) {
        fileStore.currentFile.path = newPath;
      }
    } catch (error) {
      await message(`重命名失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function handleFileDeleted(path: string, onCurrentFileDeleted: () => void) {
    try {
      await deleteFileEntry(path);
      await refreshTree();
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
    targetDir: string,
    openFile: (path: string) => void,
  ) {
    if (name === '__AUTO_RENAME__' && !isFolder) {
      await handleNewFileWithRename(targetDir, openFile);
      return;
    }
    try {
      const path = isFolder
        ? await createFolderEntry(targetDir, name)
        : await createFileEntry(targetDir, name);
      await refreshTree();
      if (!isFolder) openFile(path);
    } catch (error) {
      await message(`创建失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function handleNewFileWithRename(targetDir: string, openFile: (path: string) => void) {
    const defaultName = '未命名.md';
    try {
      const path = await createFileEntry(targetDir, defaultName);
      await refreshTree();
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
      await revealPathInFinder(path);
    } catch (error) {
      await message(`无法在文件管理器中显示: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  /** 打开文件时，若尚未设置根目录，则以文件所在目录为根 */
  function syncFolderFromFilePath(filePath: string | null) {
    if (!filePath || rootFolder.value) return;
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSlash !== -1) {
      const folder = filePath.substring(0, lastSlash);
      if (folder) loadRootFolder(folder);
    }
  }

  async function setupFileChangeListener(onRelevantChange?: (payload: FileChangePayload) => void) {
    unlistenFileChanged = await listenFileChanged<FileChangePayload>((payload) => {
      if (!rootFolder.value) return;
      if (!payload?.paths?.length) return;
      const relevant = payload.paths.some((path) => isPathInTreeRoot(path, rootFolder.value!));
      if (!relevant) return;
      void refreshTree();
      onRelevantChange?.(payload);
    });
  }

  function cleanup() {
    if (unlistenFileChanged) {
      unlistenFileChanged();
      unlistenFileChanged = null;
    }
    if (watchedFolder.value) {
      void unwatchDirectoryPath(watchedFolder.value);
      watchedFolder.value = null;
    }
  }

  return {
    rootFolder,
    treeNodes,
    flatFiles,
    pendingRenamePath,
    loadRootFolder,
    handleOpenFolder,
    toggleDir,
    refreshTree,
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
