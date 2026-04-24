import type { Ref } from 'vue';
import type { Node as PMNode } from '@tiptap/pm/model';
import { save, message } from '@tauri-apps/plugin-dialog';
import { writeHtml } from '@tauri-apps/plugin-clipboard-manager';
import { saveDocument } from '../services/tauri/document';
import { printDocument } from '../services/tauri/window';
import {
  renderEditorDocToHtmlDocument,
  renderEditorDocToWechatFragment,
} from '../utils/export-renderer';

type EditorRefValue = {
  getContent?: () => string;
  getDoc?: () => PMNode | null;
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

  function getEditorDoc(): PMNode | null {
    if (!editorRef.value || typeof editorRef.value.getDoc !== 'function') {
      return null;
    }

    return editorRef.value.getDoc();
  }

  function getMarkdown(): string {
    if (!editorRef.value) return fileStore.currentFile.content || '';
    if (typeof editorRef.value.getContent === 'function') {
      return editorRef.value.getContent() || '';
    }
    return fileStore.currentFile.content || '';
  }

  async function exportHtml() {
    if (!editorRef.value || activeViewMode.value !== 'editor') return;
    const doc = getEditorDoc();
    if (!doc) return;
    const html = await renderEditorDocToHtmlDocument(doc, {
      themeId: settingsStore.settings.wechatTheme,
      fileName:
        fileStore.currentFile.path?.split(/[/\\]/).pop()?.replace(/\.md$/i, '') ?? 'document',
    });
    const baseName =
      fileStore.currentFile.path?.split(/[/\\]/).pop()?.replace(/\.md$/, '') || 'document';
    const selected = await save({
      title: '导出为 HTML',
      defaultPath: `${baseName}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (!selected) return;
    try {
      await saveDocument(selected, html, null, true);
    } catch (error) {
      await message(`HTML 导出失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function exportPdf() {
    if (activeViewMode.value !== 'editor') return;
    try {
      await printDocument();
    } catch (error) {
      await message(`PDF 导出失败: ${error}`, { title: '错误', kind: 'error' });
    }
  }

  async function copyToWechat() {
    if (!editorRef.value || activeViewMode.value !== 'editor') return;
    const doc = getEditorDoc();
    if (!doc) return;
    const result = renderEditorDocToWechatFragment(doc, {
      themeId: settingsStore.settings.wechatTheme,
    });
    try {
      await writeHtml(result.html, result.text || getMarkdown());
      await message('已转换并复制到剪贴板', { title: '完成', kind: 'info' });
    } catch {
      await message('复制失败', { title: '错误', kind: 'error' });
    }
  }

  return {
    exportHtml,
    exportPdf,
    copyToWechat,
  };
}
