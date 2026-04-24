import { invoke } from '@tauri-apps/api/core';

export interface NativeFileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_md: boolean;
  is_txt: boolean;
  is_image: boolean;
}

export interface FileChangePayload {
  kind: string;
  paths: string[];
}

function getParentDir(path: string) {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSlash >= 0 ? path.slice(0, lastSlash) : path;
}

export async function readDocumentFile(path: string) {
  return invoke<string>('read_file', { path });
}

export async function saveDocumentFile(path: string, content: string) {
  await invoke('save_file', { path, content });
}

export async function getDocumentModifiedTime(path: string) {
  return invoke<number>('get_file_modified_time', { path });
}

export async function listSupportedDirectory(path: string) {
  return invoke<NativeFileInfo[]>('list_directory', { path });
}

export async function renameFileEntry(oldPath: string, newName: string) {
  return invoke<string>('rename_file', { oldPath, newName });
}

export async function deleteFileEntry(path: string) {
  await invoke('delete_file', { path });
}

export async function createFileEntry(dir: string, name: string) {
  return invoke<string>('create_file', { dir, name });
}

export async function createFolderEntry(dir: string, name: string) {
  return invoke<string>('create_folder', { dir, name });
}

export async function watchDirectoryPath(path: string) {
  await invoke('watch_directory', { path });
}

export async function unwatchDirectoryPath(path: string) {
  await invoke('unwatch_directory', { path });
}

export async function revealPathInFinder(path: string) {
  await invoke('reveal_in_finder', { path });
}

export async function saveImageAsset(options: {
  docPath: string;
  fileName: string;
  data: Uint8Array | number[];
}) {
  const bytes = Array.from(options.data);
  return invoke<string>('save_image', {
    dir: getParentDir(options.docPath),
    filename: options.fileName,
    data: bytes,
  });
}

export async function resolveImageAssetPath(fileDir: string, relativePath: string) {
  return invoke<string>('resolve_image_path', { fileDir, relativePath });
}

export async function fetchRemoteImageData(url: string) {
  return invoke<string>('fetch_remote_image', { url });
}
