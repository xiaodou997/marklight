import { invoke } from '@tauri-apps/api/core';
import { EditorView } from '@codemirror/view';
import type { Ref } from 'vue';
import { useFileStore } from '../../../../stores/file';

function generateImageFilename(ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `image-${timestamp}-${random}.${ext}`;
}

function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
  };
  return mimeMap[mimeType] || 'png';
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function escapeMarkdownText(text: string): string {
  return text.replace(/[[\]()]/g, '\\$&');
}

function escapeMarkdownUrl(url: string): string {
  return url.replace(/[()]/g, '\\$&');
}

function getFileDir(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSlash !== -1 ? filePath.slice(0, lastSlash) : filePath;
}

export async function saveImageAndInsertMarkdown(
  view: EditorView,
  file: File,
  fileStore: ReturnType<typeof useFileStore>,
  alt: string,
  insertPos?: number
) {
  const insertAt = typeof insertPos === 'number' ? insertPos : view.state.selection.main.from;

  if (!fileStore.currentFile.path) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      const markdown = `![${escapeMarkdownText(alt)}](${escapeMarkdownUrl(src)})`;
      view.dispatch({
        changes: { from: insertAt, to: insertAt, insert: markdown },
        selection: { anchor: insertAt + markdown.length },
      });
      window.dispatchEvent(new CustomEvent('image-paste-warning', {
        detail: '请先保存文件以启用图片本地化存储'
      }));
    };
    reader.readAsDataURL(file);
    return;
  }

  try {
    const ext = getExtensionFromMime(file.type);
    const filename = generateImageFilename(ext);
    const dir = getFileDir(fileStore.currentFile.path);
    const bytes = await fileToArrayBuffer(file);
    const data = Array.from(new Uint8Array(bytes));
    const relativePath = await invoke<string>('save_image', { dir, filename, data });
    const markdown = `![${escapeMarkdownText(alt)}](${escapeMarkdownUrl(relativePath)})`;
    view.dispatch({
      changes: { from: insertAt, to: insertAt, insert: markdown },
      selection: { anchor: insertAt + markdown.length },
    });
  } catch {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      const markdown = `![${escapeMarkdownText(alt)}](${escapeMarkdownUrl(src)})`;
      view.dispatch({
        changes: { from: insertAt, to: insertAt, insert: markdown },
        selection: { anchor: insertAt + markdown.length },
      });
    };
    reader.readAsDataURL(file);
  }
}

function getFileFromDrop(event: DragEvent): File | null {
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) return files[0];
  const items = event.dataTransfer?.items;
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

export function createImageDropExtension(fileStore: ReturnType<typeof useFileStore>, lastHtml5DropRef: Ref<number>) {
  return EditorView.domEventHandlers({
    dragover(_event) {
      const event = _event as DragEvent;
      if (event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault();
        return true;
      }
      return false;
    },
    drop(_event, view) {
      const event = _event as DragEvent;
      const file = getFileFromDrop(event);
      if (!file || !file.type.startsWith('image/')) return false;
      event.preventDefault();
      lastHtml5DropRef.value = Date.now();
      (window as any).__marklightLastHtml5Drop = Date.now();
      const coords = view.posAtCoords({ x: event.clientX, y: event.clientY });
      void saveImageAndInsertMarkdown(view, file, fileStore, file.name || 'image', coords ?? undefined);
      return true;
    },
    paste(_event, view) {
      const event = _event as ClipboardEvent;
      const items = event.clipboardData?.items;
      if (!items) return false;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          event.preventDefault();
          void saveImageAndInsertMarkdown(view, file, fileStore, 'pasted-image');
          return true;
        }
      }
      return false;
    },
  });
}
