/**
 * 统一的编辑器扩展组装入口。
 * 将 MarkdownEditorCM6.vue 中的扩展列表抽离到此处，减少 Vue 组件的职责。
 */
import { type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import type { Ref } from 'vue';

import { livePreviewExtension } from './extensions/live-preview';
import { createCm6ShortcutsExtension } from './extensions/shortcuts';
import { createImageDropExtension } from './extensions/image-drop';
import { createSmartPasteExtension } from './extensions/smart-paste';
import { taskToggleExtension } from './extensions/task-toggle';
import { codeBlockWidgetExtension } from './extensions/code-block-widget';
import { mathWidgetExtension } from './extensions/math-widget';
import { tableWidgetExtension } from './extensions/table-widget';
import { createImageWidgetExtension } from './extensions/image-widget';
import { mermaidWidgetExtension } from './extensions/mermaid-widget';
import { linkTooltipExtension } from './extensions/link-tooltip';
import { frontmatterWidgetExtension } from './extensions/frontmatter-widget';
import { calloutWidgetExtension } from './extensions/callout-widget';
import { wikilinkExtension } from './extensions/wikilink-widget';
import { editorBaseTheme } from './theme';

import type { useFileStore } from '../../../stores/file';
import type { useSettingsStore } from '../../../stores/settings';

type FileStore = ReturnType<typeof useFileStore>;
type SettingsStore = ReturnType<typeof useSettingsStore>;

export function createEditorExtensions(
  fileStore: FileStore,
  settingsStore: SettingsStore,
  lastHtml5Drop: Ref<number>
): Extension[] {
  const s = settingsStore.settings;

  const extensions: Extension[] = [
    // ── 语言与高亮 ──────────────────────────
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(defaultHighlightStyle),
    history(),
    // 过滤掉 Mod-/（toggleComment），由 App.vue 统一处理为切换源码模式
    keymap.of([...defaultKeymap.filter(b => b.key !== 'Mod-/'), ...historyKeymap]),
    createCm6ShortcutsExtension(s.customShortcuts),

    // ── 输入处理 ──────────────────────────
    createImageDropExtension(fileStore, lastHtml5Drop),
    createSmartPasteExtension(),
    taskToggleExtension,

    // ── 块级 Widget（顺序：frontmatter → callout → code → mermaid → math → table）
    frontmatterWidgetExtension,
    calloutWidgetExtension,
    codeBlockWidgetExtension,
    mermaidWidgetExtension,
    mathWidgetExtension,
    tableWidgetExtension,

    // ── 行内 Widget ───────────────────────
    createImageWidgetExtension(fileStore),

    // ── 交互 ──────────────────────────────
    linkTooltipExtension,
    wikilinkExtension(fileStore),

    // ── 布局 & 样式 ───────────────────────
    EditorView.lineWrapping,
    livePreviewExtension,
    editorBaseTheme,

    // ── 编辑器主题（字体/颜色，使用 CSS 变量） ──
    EditorView.theme({
      '&': { height: '100%' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-content': {
        fontFamily: s.fontFamily,
        fontSize: `${s.fontSize}px`,
        lineHeight: String(s.lineHeight),
        color: 'var(--text-color)',
        outline: 'none',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-color)',
        border: 'none',
        color: 'var(--muted-color)',
      },
      // 覆盖 defaultHighlightStyle 对标题加的 text-decoration: underline
      '.mk-heading': { textDecoration: 'none' },
    }),
  ];

  if (s.showLineNumbers) {
    extensions.push(lineNumbers());
  }

  return extensions;
}
