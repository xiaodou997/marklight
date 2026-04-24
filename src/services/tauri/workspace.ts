import { invokeCommand } from './client';

export type WorkspaceEntryKind = 'directory' | 'markdown' | 'text' | 'image';
export type WorkspaceEntryCreateKind = 'file' | 'folder';

export interface WorkspaceEntry {
  name: string;
  path: string;
  kind: WorkspaceEntryKind;
}

export interface WorkspaceEntryHandle {
  path: string;
  kind: WorkspaceEntryCreateKind;
}

export async function listWorkspaceEntries(rootPath: string) {
  return invokeCommand<WorkspaceEntry[]>('list_workspace_entries', { rootPath });
}

export async function createWorkspaceEntry(
  parentPath: string,
  kind: WorkspaceEntryCreateKind,
  name: string,
) {
  return invokeCommand<WorkspaceEntryHandle>('create_workspace_entry', {
    parentPath,
    kind,
    name,
  });
}

export async function renameWorkspaceEntry(path: string, newName: string) {
  return invokeCommand<{ path: string }>('rename_workspace_entry', { path, newName });
}

export async function trashWorkspaceEntry(path: string) {
  await invokeCommand<void>('trash_workspace_entry', { path });
}

export async function watchWorkspace(rootPath: string) {
  await invokeCommand<void>('watch_workspace', { rootPath });
}

export async function unwatchWorkspace(rootPath: string) {
  await invokeCommand<void>('unwatch_workspace', { rootPath });
}

export async function revealWorkspaceEntry(path: string) {
  await invokeCommand<void>('reveal_in_finder', { path });
}
