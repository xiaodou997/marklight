import { invokeCommand } from './client';
import { TAURI_COMMANDS } from './command-names';

export interface DocumentOpenResult {
  path: string;
  content: string;
  lastModifiedMs: number;
}

export interface DocumentSaveResult {
  path: string;
  lastModifiedMs: number;
}

export interface DocumentImageImportResult {
  relativePath: string;
}

export interface DocumentImageResolveResult {
  absolutePath: string;
}

export interface ImageAssetAuthorizationResult {
  path: string;
}

export async function openDocument(path: string) {
  return invokeCommand<DocumentOpenResult>(TAURI_COMMANDS.openDocument, { path });
}

export async function saveDocument(
  path: string,
  content: string,
  expectedLastModifiedMs?: number | null,
  force = false,
) {
  return invokeCommand<DocumentSaveResult>(TAURI_COMMANDS.saveDocument, {
    path,
    content,
    expectedLastModifiedMs,
    force,
  });
}

export async function importDocumentImage(sourcePath: string, documentPath: string) {
  return invokeCommand<DocumentImageImportResult>(TAURI_COMMANDS.importDocumentImage, {
    sourcePath,
    documentPath,
  });
}

export async function resolveDocumentImagePath(documentPath: string, relativePath: string) {
  return invokeCommand<DocumentImageResolveResult>(TAURI_COMMANDS.resolveDocumentImagePath, {
    documentPath,
    relativePath,
  });
}

export async function authorizeImageAsset(path: string) {
  return invokeCommand<ImageAssetAuthorizationResult>(TAURI_COMMANDS.authorizeImageAsset, { path });
}

export async function fetchRemoteImageData(url: string) {
  return invokeCommand<string>(TAURI_COMMANDS.fetchRemoteImage, { url });
}
