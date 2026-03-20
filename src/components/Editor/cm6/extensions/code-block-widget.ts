import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate, WidgetType } from '@codemirror/view';

class CodeBlockWidget extends WidgetType {
  constructor(
    private readonly code: string,
    private readonly language: string
  ) {
    super();
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

function getActiveLines(state: EditorView['state']) {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number;
    const toLine = state.doc.lineAt(range.to).number;
    for (let n = fromLine; n <= toLine; n++) lines.add(n);
  }
  return lines;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { state } = view;
  const activeLines = getActiveLines(state);

  for (const range of view.visibleRanges) {
    let line = state.doc.lineAt(range.from);
    let openLine: { from: number; lineNo: number; lang: string } | null = null;
    let content: string[] = [];

    while (line.from <= range.to) {
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

      if (line.to >= range.to) break;
      line = state.doc.line(line.number + 1);
    }
  }

  return builder.finish();
}

export const codeBlockWidgetExtension = [
  ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  }, {
    decorations: plugin => plugin.decorations,
  }),
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
