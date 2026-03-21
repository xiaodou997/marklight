import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';

class CodeBlockWidget extends WidgetType {
  constructor(
    private readonly code: string,
    private readonly language: string
  ) {
    super();
  }

  eq(other: CodeBlockWidget) {
    return this.code === other.code && this.language === other.language;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm6-codeblock-widget';

    const header = document.createElement('div');
    header.className = 'cm6-codeblock-header';
    header.textContent = this.language || 'code';
    wrapper.appendChild(header);

    const pre = document.createElement('pre');
    pre.className = 'cm6-codeblock-pre';
    const codeEl = document.createElement('code');
    codeEl.className = this.language ? `language-${this.language}` : '';
    codeEl.textContent = this.code;
    pre.appendChild(codeEl);
    wrapper.appendChild(pre);

    return wrapper;
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
  let openLine: { from: number; lineNo: number; lang: string } | null = null;
  let content: string[] = [];

  while (line.number <= doc.lines) {
    const fence = line.text.match(/^```(\w+)?\s*$/);
    if (fence) {
      if (!openLine) {
        openLine = { from: line.from, lineNo: line.number, lang: (fence[1] || '').toLowerCase() };
        content = [];
      } else {
        const closeLineNo = line.number;
        const skip = ['mermaid', 'flow', 'seq'].includes(openLine.lang);
        let hasActive = false;
        for (let n = openLine.lineNo; n <= closeLineNo; n++) {
          if (activeLines.has(n)) {
            hasActive = true;
            break;
          }
        }

        if (!hasActive && !skip) {
          builder.add(
            openLine.from,
            line.to,
            Decoration.replace({
              widget: new CodeBlockWidget(content.join('\n'), openLine.lang),
              inclusive: false,
            })
          );
        }

        openLine = null;
        content = [];
      }
    } else if (openLine) {
      content.push(line.text);
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
    '.cm6-codeblock-widget': {
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      backgroundColor: 'var(--sidebar-bg)',
      margin: '8px 0',
      overflow: 'hidden',
    },
    '.cm6-codeblock-header': {
      fontSize: '11px',
      color: '#6b7280',
      padding: '6px 10px',
      borderBottom: '1px solid var(--border-color)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      textTransform: 'lowercase',
    },
    '.cm6-codeblock-pre': {
      margin: '0',
      padding: '10px 12px',
      overflowX: 'auto',
      fontSize: '13px',
      lineHeight: '1.5',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      color: 'var(--text-color)',
    },
  }),
];
