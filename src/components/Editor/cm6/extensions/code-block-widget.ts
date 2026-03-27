import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';

/** 语言标签 widget（开启围栏行的可见内容） */
class FenceLangBadge extends WidgetType {
  constructor(private readonly lang: string) { super(); }

  eq(other: FenceLangBadge) { return this.lang === other.lang; }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'mk-codeblock-lang-text';
    span.textContent = this.lang || 'code';
    return span;
  }
}

function getActiveLines(state: EditorState) {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number;
    const toLine = state.doc.lineAt(range.to).number;
    for (let n = fromLine; n <= toLine; n++) lines.add(n);
  }
  return lines;
}

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const activeLines = getActiveLines(state);
  const doc = state.doc;

  let line = doc.line(1);
  let openLine: { lineNo: number; lang: string } | null = null;

  while (line.number <= doc.lines) {
    const fence = line.text.match(/^```(\w+)?\s*$/);

    if (fence) {
      if (!openLine) {
        const lang = (fence[1] || '').toLowerCase();
        // mermaid/flow/seq 由独立 widget 处理
        if (!['mermaid', 'flow', 'seq'].includes(lang)) {
          openLine = { lineNo: line.number, lang };
          if (!activeLines.has(line.number)) {
            // 在 .cm-line 上加 header 样式（边框、背景、圆角），内容替换为语言标签
            builder.add(line.from, line.from, Decoration.line({ class: 'mk-codeblock-fence-open' }));
            builder.add(line.from, line.to, Decoration.replace({ widget: new FenceLangBadge(lang) }));
          }
        }
      } else {
        // 关闭围栏
        if (!activeLines.has(line.number)) {
          // 在 .cm-line 上加 footer 样式，内容隐藏
          builder.add(line.from, line.from, Decoration.line({ class: 'mk-codeblock-fence-close' }));
          builder.add(line.from, line.to, Decoration.replace({}));
        }
        openLine = null;
      }
    } else if (openLine) {
      // 代码内容行：保持可编辑，加行样式
      builder.add(line.from, line.from, Decoration.line({ class: 'mk-codeblock-content-line' }));
    }

    if (line.number >= doc.lines) break;
    line = doc.line(line.number + 1);
  }

  return builder.finish();
}

const codeBlockField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(oldDecos, tr) {
    if (tr.docChanged || tr.selection) {
      return buildDecorations(tr.state);
    }
    return oldDecos;
  },
  provide: f => EditorView.decorations.from(f),
});

export const codeBlockWidgetExtension = [
  codeBlockField,
  EditorView.baseTheme({
    // 开启围栏行：header 栏样式，直接作用于 .cm-line
    '.mk-codeblock-fence-open': {
      backgroundColor: 'var(--sidebar-bg)',
      border: '1px solid var(--border-color)',
      borderBottom: '1px solid var(--border-color)',
      borderRadius: '8px 8px 0 0',
      color: '#6b7280',
      fontSize: '11px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      marginTop: '8px',
      padding: '5px 10px',
    },
    // 语言标签文字（widget 内容）
    '.mk-codeblock-lang-text': {
      fontSize: '11px',
      textTransform: 'lowercase',
    },
    // 代码内容行：灰底 + 等宽字体 + 左右边框
    '.mk-codeblock-content-line': {
      backgroundColor: 'var(--sidebar-bg)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '13px',
      borderLeft: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      paddingLeft: '10px',
      paddingRight: '10px',
    },
    // 关闭围栏行：footer 样式（左下右边框 + 圆角），内容隐藏后高度由 padding 撑开
    '.mk-codeblock-fence-close': {
      backgroundColor: 'var(--sidebar-bg)',
      borderLeft: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      borderBottom: '1px solid var(--border-color)',
      borderRadius: '0 0 8px 8px',
      padding: '4px 0',
      marginBottom: '8px',
    },
  }),
];
