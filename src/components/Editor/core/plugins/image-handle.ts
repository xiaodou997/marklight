import { Plugin } from 'prosemirror-state';
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
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 异步保存图片并插入到编辑器
 */
async function saveAndInsertImage(
  view: any,
  file: File,
  fileStore: ReturnType<typeof useFileStore>,
  alt: string
): Promise<void> {
  if (!fileStore.currentFile.path) {
    // 文件未保存，使用 data URL 并提示
    const reader = new FileReader();
    reader.onload = (e) => {
      const node = mySchema.nodes.image.create({
        src: e.target?.result,
        alt
      });
      view.dispatch(view.state.tr.replaceSelectionWith(node));
      
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
    
    // 读取图片数据
    const arrayBuffer = await fileToArrayBuffer(file);
    const data = Array.from(new Uint8Array(arrayBuffer));
    
    // 调用 Rust 命令保存图片
    const relativePath = await invoke<string>('save_image', {
      dir,
      filename,
      data
    });
    
    // 插入相对路径
    const node = mySchema.nodes.image.create({
      src: relativePath,
      alt
    });
    view.dispatch(view.state.tr.replaceSelectionWith(node));
  } catch (error) {
    console.error('保存图片失败:', error);
    // 失败时回退到 data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const node = mySchema.nodes.image.create({
        src: e.target?.result,
        alt
      });
      view.dispatch(view.state.tr.replaceSelectionWith(node));
    };
    reader.readAsDataURL(file);
  }
}

export const createImageHandlePlugin = () => {
  return new Plugin({
    props: {
      handleDOMEvents: {
        drop(view, event) {
          const files = event.dataTransfer?.files;
          if (!files || files.length === 0) return false;

          const file = files[0];
          if (!file.type.startsWith('image/')) return false;

          event.preventDefault();

          const fileStore = useFileStore();
          // 无论是否有本地路径，都统一执行本地化保存逻辑
          saveAndInsertImage(view, file, fileStore, file.name);

          return true;
        },
        paste(view, event) {
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
