import type { Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { save, message } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { writeHtml } from '@tauri-apps/plugin-clipboard-manager';
import { renderMarkdownToWechatHtml } from '../utils/wechat-renderer';

type EditorRefValue = {
  getContent?: () => string;
};
type EditorRef = Ref<EditorRefValue | null>;
type ViewModeRef = Ref<'editor' | 'image'>;

type FileStoreLike = {
  currentFile: {
    path: string | null;
    content: string;
  };
};

type SettingsStoreLike = {
  settings: {
    wechatTheme: string;
  };
};

export function useExportActions(options: {
  editorRef: EditorRef;
  activeViewMode: ViewModeRef;
  fileStore: FileStoreLike;
  settingsStore: SettingsStoreLike;
}) {
  const { editorRef, activeViewMode, fileStore, settingsStore } = options;

  function getMarkdown(): string {
    if (!editorRef.value) return fileStore.currentFile.content || '';
    if (typeof editorRef.value.getContent === 'function') {
      return editorRef.value.getContent() || '';
    }
    return fileStore.currentFile.content || '';
  }

  async function exportHtml() {
    if (!editorRef.value || activeViewMode.value !== 'editor') return;
    const markdown = getMarkdown();
    const html = await renderMarkdownToWechatHtml(markdown, settingsStore.settings.wechatTheme);
    const baseName = fileStore.currentFile.path?.split(/[/\\]/).pop()?.replace(/\.md$/, '') || 'document';
    const selected = await save({
      title: '导出为 HTML',
      defaultPath: `${baseName}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }]
    });
    if (!selected) return;
    try {
      await writeTextFile(selected, html);
    } catch (error) {
      await message(`HTML 导出失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function exportPdf() {
    if (activeViewMode.value !== 'editor') return;
    try {
      await invoke('print_document');
    } catch (error) {
      await message(`PDF 导出失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function copyToWechat() {
    if (!editorRef.value || activeViewMode.value !== 'editor') return;
    const markdown = getMarkdown();
    const html = await renderMarkdownToWechatHtml(markdown, settingsStore.settings.wechatTheme);
    try {
      await writeHtml(html, markdown);
      await message('已转换并复制到剪贴板', { title: '完成', kind: 'info' });
    } catch {
      await message('复制失败', { title: '错误', kind: 'error' });
    }
  }

  return {
    exportHtml,
    exportPdf,
    copyToWechat
  };
}
