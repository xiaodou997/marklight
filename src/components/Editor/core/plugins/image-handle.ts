import { Plugin } from 'prosemirror-state';
import { schema } from 'prosemirror-markdown';

/**
 * 尝试从 File 对象中获取路径 (Tauri 特有)
 */
function getFilePath(file: File): string | null {
  // 在 Tauri 中，拖拽进来的 File 对象通常包含一个 path 属性
  return (file as any).path || null;
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

          const path = getFilePath(file);
          const { state, dispatch } = view;

          if (path) {
            // 1. 如果有真实路径（本地拖入），直接使用绝对路径
            const node = schema.nodes.image.create({
              src: path,
              alt: file.name
            });
            dispatch(state.tr.replaceSelectionWith(node));
          } else {
            // 2. 如果没有路径（如从浏览器拖入），回退到 Base64 或上传逻辑
            const reader = new FileReader();
            reader.onload = (e) => {
              const node = schema.nodes.image.create({
                src: e.target?.result,
                alt: file.name
              });
              dispatch(view.state.tr.replaceSelectionWith(node));
            };
            reader.readAsDataURL(file);
          }

          return true;
        },
        paste(view, event) {
          const items = event.clipboardData?.items;
          if (!items) return false;

          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                // 剪贴板图片通常没有路径，需要处理为 Base64 
                // 或者在实际项目中，这里会调用 Tauri 命令保存到本地 /assets 目录
                const reader = new FileReader();
                reader.onload = (e) => {
                   const node = schema.nodes.image.create({ 
                     src: e.target?.result,
                     alt: 'pasted-image'
                   });
                   view.dispatch(view.state.tr.replaceSelectionWith(node));
                };
                reader.readAsDataURL(file);
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
