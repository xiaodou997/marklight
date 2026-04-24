import { invokeCommand } from './client';

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

export async function openDocument(path: string) {
  return invokeCommand<DocumentOpenResult>('open_document', { path });
}

export async function saveDocument(
  path: string,
  content: string,
  expectedLastModifiedMs?: number | null,
  force = false,
) {
  return invokeCommand<DocumentSaveResult>('save_document', {
    path,
    content,
    expectedLastModifiedMs,
    force,
  });
}

export async function importDocumentImage(sourcePath: string, documentPath: string) {
  return invokeCommand<DocumentImageImportResult>('import_document_image', {
    sourcePath,
    documentPath,
  });
}

export async function resolveDocumentImagePath(documentPath: string, relativePath: string) {
  return invokeCommand<DocumentImageResolveResult>('resolve_document_image_path', {
    documentPath,
    relativePath,
  });
}

export async function fetchRemoteImageData(url: string) {
  return invokeCommand<string>('fetch_remote_image', { url });
}
