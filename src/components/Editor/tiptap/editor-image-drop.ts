import type { UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { Editor as TiptapEditor } from '@tiptap/vue-3';

import { importDocumentImage } from '../../../services/tauri/document';

interface EditorRef {
  value: TiptapEditor | null;
}

interface SetupEditorImageDropOptions {
  editor: EditorRef;
  getDocumentPath: () => string | null;
}

const supportedImageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

function isSupportedImagePath(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return supportedImageExtensions.has(ext);
}

export async function setupEditorImageDrop({
  editor,
  getDocumentPath,
}: SetupEditorImageDropOptions): Promise<UnlistenFn | null> {
  try {
    const webview = getCurrentWebview();
    return await webview.onDragDropEvent(async (event) => {
      if (event.payload.type !== 'drop') return;
      const paths = event.payload.paths;
      if (!paths?.length || !editor.value) return;

      const documentPath = getDocumentPath();
      if (!documentPath) return;

      for (const imagePath of paths) {
        if (!isSupportedImagePath(imagePath)) continue;

        try {
          const savedImage = await importDocumentImage(imagePath, documentPath);

          editor.value.chain().focus().setImage({ src: savedImage.relativePath, alt: '' }).run();
        } catch (err) {
          console.error('Failed to handle dropped image:', err);
        }
      }
    });
  } catch (err) {
    console.error('Failed to setup drag-drop:', err);
    return null;
  }
}
