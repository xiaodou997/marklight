import { EditorView } from '@codemirror/view';

/**
 * 统一的编辑器 baseTheme。
 * 所有扩展的样式都收拢到这里，通过 CSS 变量支持深色/浅色主题切换。
 * 不要在各个 extension 文件中再定义 EditorView.baseTheme()。
 */
export const editorBaseTheme = EditorView.baseTheme({
  // ── 通用语法标记 ──────────────────────────────────────────────
  '.mk-syntax-mark': {
    color: 'var(--muted-color)',
    fontFamily: 'var(--font-mono)',
  },

  // ── 标题 H1-H6（Obsidian 风格） ───────────────────────────────
  '.mk-heading': { textDecoration: 'none !important' },
  '.mk-heading-1': { fontSize: '1.875em', fontWeight: '700', lineHeight: '1.3', textDecoration: 'none' },
  '.mk-heading-2': { fontSize: '1.5em', fontWeight: '600', lineHeight: '1.35', textDecoration: 'none' },
  '.mk-heading-3': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.4', textDecoration: 'none' },
  '.mk-heading-4': { fontSize: '1.125em', fontWeight: '600', lineHeight: '1.4', textDecoration: 'none' },
  '.mk-heading-5': { fontSize: '1em', fontWeight: '600', lineHeight: '1.4', textDecoration: 'none' },
  '.mk-heading-6': { fontSize: '0.9em', fontWeight: '600', lineHeight: '1.4', color: 'var(--muted-color)', textDecoration: 'none' },

  // ── 行内格式 ──────────────────────────────────────────────────
  '.mk-strong': { fontWeight: '700' },
  '.mk-emphasis': { fontStyle: 'italic' },
  '.mk-strikethrough': { textDecoration: 'line-through', color: 'var(--muted-color)' },
  '.mk-sub': { fontSize: '0.75em', verticalAlign: 'sub' },
  '.mk-sup': { fontSize: '0.75em', verticalAlign: 'super' },
  '.mk-highlight': {
    backgroundColor: '#fef08a',
    borderRadius: '2px',
    padding: '0 2px',
  },
  '.mk-inline-code': {
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--code-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '0.1em 4px',
    fontSize: '0.875em',
  },

  // ── 链接 ──────────────────────────────────────────────────────
  '.mk-link': {
    color: 'var(--primary-color)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },

  // ── Wikilink ─────────────────────────────────────────────────
  '.mk-wikilink': {
    color: 'var(--primary-color)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
    textDecorationStyle: 'solid',
  },
  '.mk-wikilink-missing': {
    color: 'var(--muted-color)',
    textDecoration: 'underline',
    textDecorationStyle: 'dashed',
    cursor: 'pointer',
  },

  // ── 标签 #tag ─────────────────────────────────────────────────
  '.mk-tag': {
    backgroundColor: 'var(--tag-bg)',
    color: 'var(--tag-color)',
    borderRadius: '12px',
    padding: '0.1em 6px',
    fontSize: '0.85em',
    cursor: 'pointer',
  },

  // ── 引用块 ────────────────────────────────────────────────────
  '.mk-blockquote-line': {
    borderLeft: '3px solid var(--primary-color)',
    paddingLeft: '12px',
    backgroundColor: 'var(--quote-bg, transparent)',
  },
  '.mk-blockquote': {
    color: 'var(--text-color)',
    opacity: '0.85',
  },

  // ── 列表 ──────────────────────────────────────────────────────
  '.mk-list-prefix': {
    color: 'var(--muted-color)',
    fontFamily: 'var(--font-mono)',
  },
  '.mk-list-item': {
    color: 'var(--text-color)',
  },

  // ── 任务列表复选框 ────────────────────────────────────────────
  '.mk-task-label': {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    marginRight: '4px',
    verticalAlign: 'middle',
    userSelect: 'none',
  },
  '.mk-task-checkbox': {
    width: '15px',
    height: '15px',
    borderRadius: '4px',
    accentColor: 'var(--primary-color)',
    cursor: 'pointer',
    verticalAlign: 'middle',
    margin: '0',
  },

  // ── 水平线 ────────────────────────────────────────────────────
  '.mk-hr-widget': {
    display: 'block',
    width: '100%',
    borderTop: '1px solid var(--border-color)',
    marginTop: '0.5em',
    marginBottom: '0.5em',
    height: '0',
  },

  // ── 代码块 ───────────────────────────────────────────────────
  '.mk-codeblock-widget': {
    display: 'block',
    margin: '4px 0',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
  },
  '.mk-codeblock-fence-open': {
    backgroundColor: 'var(--code-bg)',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--muted-color)',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    padding: '5px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  '.mk-codeblock-lang-text': {
    fontSize: '11px',
    textTransform: 'lowercase',
    color: 'var(--muted-color)',
  },
  '.mk-codeblock-edit-btn': {
    marginLeft: 'auto',
    fontSize: '11px',
    opacity: '0',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    padding: '1px 4px',
    borderRadius: '3px',
    userSelect: 'none',
  },
  '.mk-codeblock-fence-open:hover .mk-codeblock-edit-btn': {
    opacity: '0.6',
  },
  '.mk-codeblock-content-line': {
    backgroundColor: 'var(--code-bg)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    borderLeft: '1px solid var(--border-color)',
    borderRight: '1px solid var(--border-color)',
    paddingLeft: '12px',
    paddingRight: '12px',
  },
  '.mk-codeblock-render': {
    backgroundColor: 'var(--code-bg)',
    padding: '8px 12px',
    overflowX: 'auto',
    marginBottom: '0',
  },
  '.mk-codeblock-render-pre': {
    margin: '0',
    whiteSpace: 'pre',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '1.6',
    background: 'transparent',
  },
  '.mk-codeblock-render-pre code': {
    background: 'transparent',
    padding: '0',
    borderRadius: '0',
  },
  '.mk-codeblock-fence-close': {
    backgroundColor: 'var(--code-bg)',
    padding: '0',
    height: '6px',
  },

  // ── 表格 ─────────────────────────────────────────────────────
  '.mk-table-widget': {
    margin: '12px 0',
    overflowX: 'auto',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
  },
  '.mk-table': {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'var(--bg-color)',
  },
  '.mk-table th': {
    backgroundColor: 'var(--sidebar-bg)',
    borderBottom: '1px solid var(--border-color)',
    borderRight: '1px solid var(--border-color)',
    textAlign: 'left',
    padding: '7px 12px',
    fontWeight: '600',
    fontSize: '0.9em',
    whiteSpace: 'nowrap',
  },
  '.mk-table td': {
    borderTop: '1px solid var(--border-color)',
    borderRight: '1px solid var(--border-color)',
    padding: '6px 12px',
    verticalAlign: 'top',
  },
  '.mk-table tbody tr:nth-child(even) td': {
    backgroundColor: 'var(--sidebar-bg)',
  },
  '.mk-table tbody tr:hover td': {
    backgroundColor: 'var(--hover-bg, rgba(0,0,0,0.03))',
  },
  '.mk-table th:last-child, .mk-table td:last-child': {
    borderRight: 'none',
  },

  // ── Mermaid 图表 ─────────────────────────────────────────────
  '.mk-mermaid-widget': {
    margin: '12px 0',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-color)',
    overflow: 'hidden',
  },
  '.mk-mermaid-badge': {
    fontSize: '11px',
    color: 'var(--muted-color)',
    padding: '5px 12px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--code-bg)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'lowercase',
  },
  '.mk-mermaid-content': {
    padding: '12px',
    overflowX: 'auto',
    color: '#ef4444',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
  },

  // ── 数学公式 ─────────────────────────────────────────────────
  '.mk-math-widget': {
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    backgroundColor: 'var(--sidebar-bg)',
    padding: '10px 14px',
    margin: '8px 0',
    overflowX: 'auto',
  },

  // ── 图片 ─────────────────────────────────────────────────────
  '.mk-image-widget': {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '6px',
    margin: '8px 0',
    maxWidth: '100%',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '6px',
    backgroundColor: 'var(--bg-color)',
  },
  '.mk-image-widget-el': {
    maxWidth: '100%',
    maxHeight: '520px',
    objectFit: 'contain',
    borderRadius: '4px',
  },
  '.mk-image-widget-caption': {
    fontSize: '12px',
    color: 'var(--muted-color)',
    lineHeight: '1.3',
  },

  // ── Callout 块 ───────────────────────────────────────────────
  '.mk-callout': {
    borderLeft: '4px solid',
    borderRadius: '4px',
    padding: '10px 14px',
    margin: '10px 0',
    fontSize: '0.95em',
  },
  '.mk-callout-title': {
    fontWeight: '600',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  '.mk-callout-body': {
    marginTop: '4px',
  },
  '.mk-callout-note': {
    borderColor: 'var(--callout-note)',
    backgroundColor: 'var(--callout-note-bg)',
    color: 'var(--text-color)',
  },
  '.mk-callout-tip': {
    borderColor: 'var(--callout-tip)',
    backgroundColor: 'var(--callout-tip-bg)',
    color: 'var(--text-color)',
  },
  '.mk-callout-warning': {
    borderColor: 'var(--callout-warning)',
    backgroundColor: 'var(--callout-warning-bg)',
    color: 'var(--text-color)',
  },
  '.mk-callout-danger': {
    borderColor: 'var(--callout-danger)',
    backgroundColor: 'var(--callout-danger-bg)',
    color: 'var(--text-color)',
  },
  '.mk-callout-success': {
    borderColor: 'var(--callout-success)',
    backgroundColor: 'var(--callout-success-bg)',
    color: 'var(--text-color)',
  },
  '.mk-callout-quote': {
    borderColor: 'var(--muted-color)',
    backgroundColor: 'var(--sidebar-bg)',
    color: 'var(--text-color)',
    fontStyle: 'italic',
  },

  // ── Frontmatter ───────────────────────────────────────────────
  '.mk-frontmatter': {
    backgroundColor: 'var(--sidebar-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    margin: '0 0 8px 0',
    color: 'var(--muted-color)',
    cursor: 'default',
  },
  '.mk-frontmatter-header': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--muted-color)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  '.mk-frontmatter-key': {
    color: 'var(--primary-color)',
    fontWeight: '500',
  },
  '.mk-frontmatter-value': {
    color: 'var(--text-color)',
  },
  '.mk-frontmatter-row': {
    lineHeight: '1.7',
  },
});
