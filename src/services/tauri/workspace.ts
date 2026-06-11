import { invokeCommand } from './client';
import { TAURI_COMMANDS } from './command-names';

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
  return invokeCommand<WorkspaceEntry[]>(TAURI_COMMANDS.listWorkspaceEntries, { rootPath });
}

export async function createWorkspaceEntry(
  parentPath: string,
  kind: WorkspaceEntryCreateKind,
  name: string,
) {
  return invokeCommand<WorkspaceEntryHandle>(TAURI_COMMANDS.createWorkspaceEntry, {
    parentPath,
    kind,
    name,
  });
}

export async function renameWorkspaceEntry(path: string, newName: string) {
  return invokeCommand<{ path: string }>(TAURI_COMMANDS.renameWorkspaceEntry, { path, newName });
}

export async function trashWorkspaceEntry(path: string) {
  await invokeCommand<void>(TAURI_COMMANDS.trashWorkspaceEntry, { path });
}

export async function watchWorkspace(rootPath: string) {
  await invokeCommand<void>(TAURI_COMMANDS.watchWorkspace, { rootPath });
}

export async function unwatchWorkspace(rootPath: string) {
  await invokeCommand<void>(TAURI_COMMANDS.unwatchWorkspace, { rootPath });
}

export async function revealWorkspaceEntry(path: string) {
  await invokeCommand<void>(TAURI_COMMANDS.revealInFinder, { path });
}
