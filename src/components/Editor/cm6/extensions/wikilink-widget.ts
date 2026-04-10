import { EditorView } from '@codemirror/view';
import { invoke } from '@tauri-apps/api/core';
import type { useFileStore } from '../../../../stores/file';

/**
 * Wikilink 点击跳转扩展。
 * 行内装饰（[[page]] 渲染为链接样式）已由 decorators/inline.ts 中的 decorateInline 处理。
 * 这里只负责点击 .mk-wikilink 时打开对应文件。
 */
export function wikilinkExtension(fileStore: ReturnType<typeof useFileStore>) {
  return EditorView.domEventHandlers({
    click(event, _view) {
      const target = event.target as HTMLElement;
      if (!target.classList.contains('mk-wikilink')) return false;

      const wikilinkRaw = target.dataset.wikilink;
      if (!wikilinkRaw) return false;

      // 解析：[[page#heading|alias]] → 取 page 部分
      const pagePart = wikilinkRaw.split('|')[0].split('#')[0].trim();
      if (!pagePart) return false;

      event.preventDefault();

      // 根据当前文件所在目录构造目标路径
      const currentPath = fileStore.currentFile.path;
      if (!currentPath) return false;

      const dir = currentPath.replace(/[/\\][^/\\]+$/, '');
      // 尝试带 .md 后缀
      const targetPath = pagePart.includes('.')
        ? `${dir}/${pagePart}`
        : `${dir}/${pagePart}.md`;

      void invoke('open_file_path', { path: targetPath }).catch(() => {
        // 如果目标文件不存在，忽略错误
        console.warn(`[wikilink] 文件不存在: ${targetPath}`);
      });

      return true;
    },
  });
}
