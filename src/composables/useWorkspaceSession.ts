import { open, message } from '@tauri-apps/plugin-dialog';
import { computed, onUnmounted, ref } from 'vue';
import type { WorkspaceChangedPayload } from '../services/tauri/events';
import { listenWorkspaceChanged } from '../services/tauri/events';
import {
  createWorkspaceEntry,
  listWorkspaceEntries,
  renameWorkspaceEntry,
  revealWorkspaceEntry,
  trashWorkspaceEntry,
  unwatchWorkspace,
  watchWorkspace,
  type WorkspaceEntry,
} from '../services/tauri/workspace';
import { useFileStore } from '../stores/file';

export interface TreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  is_md: boolean;
  is_txt: boolean;
  is_image: boolean;
  expanded: boolean;
  children: TreeNode[] | null;
}

interface WorkspaceSessionOptions {
  openDocument: (path: string) => void | Promise<void>;
  onCurrentDocumentDeleted: () => void;
  onWorkspaceChanged?: (payload: WorkspaceChangedPayload) => void | Promise<void>;
}

function workspaceEntryToTreeNode(entry: WorkspaceEntry): TreeNode {
  return {
    name: entry.name,
    path: entry.path,
    is_dir: entry.kind === 'directory',
    is_md: entry.kind === 'markdown',
    is_txt: entry.kind === 'text',
    is_image: entry.kind === 'image',
    expanded: false,
    children: entry.kind === 'directory' ? null : [],
  };
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.is_dir && node.children) {
      const found = findNode(node.children, path);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function mergeChildren(nextEntries: WorkspaceEntry[], previousNodes: TreeNode[]): TreeNode[] {
  const previousMap = new Map(previousNodes.map((node) => [node.path, node]));
  return nextEntries.map((entry) => {
    const previousNode = previousMap.get(entry.path);
    if (previousNode && previousNode.is_dir) {
      return {
        ...workspaceEntryToTreeNode(entry),
        expanded: previousNode.expanded,
        children: previousNode.children,
      };
    }
    return workspaceEntryToTreeNode(entry);
  });
}

async function refreshExpandedNodes(nodes: TreeNode[]) {
  for (const node of nodes) {
    if (!node.is_dir || !node.expanded) {
      continue;
    }

    try {
      const children = await listWorkspaceEntries(node.path);
      node.children = mergeChildren(children, node.children ?? []);
      await refreshExpandedNodes(node.children);
    } catch {
      continue;
    }
  }
}

export function useWorkspaceSession(options: WorkspaceSessionOptions) {
  const fileStore = useFileStore();

  const rootFolder = ref<string | null>(null);
  const treeNodes = ref<TreeNode[]>([]);
  const pendingRenamePath = ref<string | null>(null);
  const watchedFolder = ref<string | null>(null);

  let unlistenWorkspace: (() => void) | null = null;

  const flatAllNodes = computed(() => {
    const nodes: TreeNode[] = [];
    const collect = (items: TreeNode[]) => {
      for (const item of items) {
        nodes.push(item);
        if (item.is_dir && item.children) {
          collect(item.children);
        }
      }
    };
    collect(treeNodes.value);
    return nodes;
  });

  const flatFiles = computed(() => flatAllNodes.value.filter((node) => !node.is_dir));

  async function loadWorkspace(rootPath: string) {
    try {
      const entries = await listWorkspaceEntries(rootPath);
      rootFolder.value = rootPath;
      treeNodes.value = entries.map(workspaceEntryToTreeNode);

      if (watchedFolder.value && watchedFolder.value !== rootPath) {
        await unwatchWorkspace(watchedFolder.value);
      }
      if (watchedFolder.value !== rootPath) {
        await watchWorkspace(rootPath);
        watchedFolder.value = rootPath;
      }
      return true;
    } catch (error) {
      console.error('Failed to load workspace:', error);
      await message(`读取文件夹失败: ${String(error)}`, { title: '错误', kind: 'error' });
      return false;
    }
  }

  async function openWorkspacePicker() {
    const selected = await open({ directory: true, title: '选择文件夹' });
    if (!selected || typeof selected !== 'string') {
      return false;
    }
    return loadWorkspace(selected);
  }

  async function toggleDir(path: string) {
    const node = findNode(treeNodes.value, path);
    if (!node || !node.is_dir) {
      return;
    }

    if (node.expanded) {
      node.expanded = false;
      return;
    }

    if (node.children === null) {
      try {
        const children = await listWorkspaceEntries(node.path);
        node.children = children.map(workspaceEntryToTreeNode);
      } catch {
        node.children = [];
      }
    }
    node.expanded = true;
  }

  async function refreshTree() {
    if (!rootFolder.value) {
      return;
    }

    try {
      const entries = await listWorkspaceEntries(rootFolder.value);
      treeNodes.value = mergeChildren(entries, treeNodes.value);
      await refreshExpandedNodes(treeNodes.value);
    } catch {
      return;
    }
  }

  async function renameEntry(path: string, newName: string) {
    try {
      const renamed = await renameWorkspaceEntry(path, newName);
      await refreshTree();
      if (fileStore.currentFile.path === path) {
        fileStore.currentFile.path = renamed.path;
      }
    } catch (error) {
      await message(`重命名失败: ${String(error)}`, { title: '错误', kind: 'error' });
    }
  }

  async function deleteEntry(path: string) {
    try {
      await trashWorkspaceEntry(path);
      await refreshTree();
      if (fileStore.currentFile.path === path) {
        fileStore.reset();
        options.onCurrentDocumentDeleted();
      }
    } catch (error) {
      await message(`删除失败: ${String(error)}`, { title: '错误', kind: 'error' });
    }
  }

  async function createEntry(
    name: string,
    isFolder: boolean,
    targetDir = rootFolder.value,
  ) {
    if (!targetDir) {
      return;
    }

    if (name === '__AUTO_RENAME__' && !isFolder) {
      return createUntitledFile(targetDir);
    }

    try {
      const created = await createWorkspaceEntry(targetDir, isFolder ? 'folder' : 'file', name);
      await refreshTree();
      if (!isFolder) {
        await options.openDocument(created.path);
      }
    } catch (error) {
      await message(`创建失败: ${String(error)}`, { title: '错误', kind: 'error' });
    }
  }

  async function createUntitledFile(targetDir: string) {
    try {
      const created = await createWorkspaceEntry(targetDir, 'file', '未命名.md');
      await refreshTree();
      await options.openDocument(created.path);
      pendingRenamePath.value = created.path;
    } catch (error) {
      await message(`创建失败: ${String(error)}`, { title: '错误', kind: 'error' });
    }
  }

  function handleRenameCompleted() {
    pendingRenamePath.value = null;
  }

  async function revealInFinder(path: string) {
    try {
      await revealWorkspaceEntry(path);
    } catch (error) {
      await message(`无法在文件管理器中显示: ${String(error)}`, {
        title: '错误',
        kind: 'error',
      });
    }
  }

  function syncWorkspaceFromDocumentPath(filePath: string | null) {
    if (!filePath || rootFolder.value) {
      return;
    }

    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSlash === -1) {
      return;
    }

    const folder = filePath.slice(0, lastSlash);
    if (folder) {
      void loadWorkspace(folder);
    }
  }

  async function setup() {
    unlistenWorkspace = await listenWorkspaceChanged(async (payload) => {
      if (!rootFolder.value || payload.rootPath !== rootFolder.value) {
        return;
      }

      await refreshTree();
      await options.onWorkspaceChanged?.(payload);
    });
  }

  function cleanup() {
    unlistenWorkspace?.();
    unlistenWorkspace = null;
    if (watchedFolder.value) {
      void unwatchWorkspace(watchedFolder.value);
      watchedFolder.value = null;
    }
  }

  onUnmounted(cleanup);

  return {
    rootFolder,
    treeNodes,
    flatFiles,
    pendingRenamePath,
    loadWorkspace,
    openWorkspacePicker,
    toggleDir,
    refreshTree,
    renameEntry,
    deleteEntry,
    createEntry,
    handleRenameCompleted,
    revealInFinder,
    syncWorkspaceFromDocumentPath,
    setup,
    cleanup,
  };
}
