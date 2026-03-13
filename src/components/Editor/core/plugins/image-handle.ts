import { Plugin, TextSelection } from 'prosemirror-state';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../../../stores/file';
import { mySchema } from '../schema';

/**
 * 尝试从 File 对象获取路径 (Tauri 特有)
 */
function getFilePath(file: File): string | null {
  return (file as any).path || null;
}

/**
 * 生成图片文件名
 * 格式: image-{timestamp}-{random4}.{ext}
 */
function generateImageFilename(ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `image-${timestamp}-${random}.${ext}`;
}

/**
 * 从 MIME 类型获取文件扩展名
 */
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

/**
 * 将 File 对象转换为 ArrayBuffer
 */
function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (e) => {
      console.error('[ImageHandle] fileToArrayBuffer error', e);
      reject(e);
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 异步保存图片并插入到编辑器
 */
export async function saveAndInsertImage(
  view: any,
  file: File,
  fileStore: ReturnType<typeof useFileStore>,
  alt: string,
  insertPos?: number
): Promise<void> {
  console.log('[ImageHandle] saveAndInsertImage', {
    name: file.name,
    type: file.type,
    size: file.size,
    hasPath: Boolean(fileStore.currentFile.path),
    insertPos
  });
  if (!fileStore.currentFile.path) {
    // 文件未保存，使用 data URL 并提示
    const reader = new FileReader();
    reader.onload = (e) => {
      const node = mySchema.nodes.image.create({
        src: e.target?.result,
        alt
      });
      let tr = view.state.tr;
      if (typeof insertPos === 'number') {
        tr = tr.setSelection(TextSelection.create(view.state.doc, insertPos));
      }
      try {
        view.dispatch(tr.replaceSelectionWith(node).scrollIntoView());
        console.log('[ImageHandle] inserted data URL image');
      } catch (err) {
        console.error('[ImageHandle] insert data URL failed', err);
      }
      
      // 发送提示事件
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
    
    // 获取文件所在目录
    const filePath = fileStore.currentFile.path;
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    const dir = lastSlash !== -1 ? filePath.substring(0, lastSlash) : filePath;
    console.log('[ImageHandle] saving image', { dir, filename });
    
    // 读取图片数据
    const arrayBuffer = await fileToArrayBuffer(file);
    const data = Array.from(new Uint8Array(arrayBuffer));
    
    // 调用 Rust 命令保存图片
    const relativePath = await invoke<string>('save_image', {
      dir,
      filename,
      data
    });
    console.log('[ImageHandle] save_image ok', { relativePath });
    
    // 插入相对路径
    const node = mySchema.nodes.image.create({
      src: relativePath,
      alt
    });
    let tr = view.state.tr;
    if (typeof insertPos === 'number') {
      tr = tr.setSelection(TextSelection.create(view.state.doc, insertPos));
    }
    try {
      view.dispatch(tr.replaceSelectionWith(node).scrollIntoView());
      console.log('[ImageHandle] inserted local image');
    } catch (err) {
      console.error('[ImageHandle] insert local image failed', err);
    }
  } catch (error) {
    console.error('保存图片失败:', error);
    // 失败时回退到 data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const node = mySchema.nodes.image.create({
        src: e.target?.result,
        alt
      });
      let tr = view.state.tr;
      if (typeof insertPos === 'number') {
        tr = tr.setSelection(TextSelection.create(view.state.doc, insertPos));
      }
      try {
        view.dispatch(tr.replaceSelectionWith(node).scrollIntoView());
        console.log('[ImageHandle] inserted fallback data URL image');
      } catch (err) {
        console.error('[ImageHandle] insert fallback image failed', err);
      }
    };
    reader.readAsDataURL(file);
  }
}

export function getFileFromDrop(event: DragEvent): File | null {
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    return files[0];
  }
  const items = event.dataTransfer?.items;
  if (items) {
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  return null;
}

export const createImageHandlePlugin = () => {
  return new Plugin({
    props: {
      handleDOMEvents: {
        dragover(_view, event) {
          if (event.dataTransfer?.types?.includes('Files')) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        drop(view, event) {
          console.log('[ImageHandle] drop', {
            hasFiles: Boolean(event.dataTransfer?.files?.length),
            types: event.dataTransfer?.types
          });
          const file = getFileFromDrop(event);
          if (!file) return false;
          if (!file.type.startsWith('image/')) return false;

          event.preventDefault();
          (window as any).__marklightLastHtml5Drop = Date.now();

          const fileStore = useFileStore();
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const insertPos = coords?.pos;
          console.log('[ImageHandle] drop coords', coords);
          // 无论是否有本地路径，都统一执行本地化保存逻辑
          saveAndInsertImage(view, file, fileStore, file.name, insertPos);

          return true;
        },
        paste(view, event) {
          console.log('[ImageHandle] paste', { types: event.clipboardData?.types });
          const items = event.clipboardData?.items;
          if (!items) return false;

          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                const fileStore = useFileStore();
                // 异步保存图片
                saveAndInsertImage(view, file, fileStore, 'pasted-image');
                return true;
              }
            }
          }
          return false;
        }
      }
    }
  });
};
