import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate, WidgetType } from '@codemirror/view';
import katex from 'katex';
import 'katex/dist/katex.min.css';

class MathBlockWidget extends WidgetType {
  constructor(private readonly latex: string) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm6-math-widget';
    try {
      wrapper.innerHTML = katex.renderToString(this.latex, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      wrapper.textContent = this.latex;
    }
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
    let openLine: { from: number; lineNo: number } | null = null;
    let content: string[] = [];

    while (line.from <= range.to) {
      const isFence = line.text.trim() === '$$';
      if (isFence) {
        if (!openLine) {
          openLine = { from: line.from, lineNo: line.number };
          content = [];
        } else {
          const closeLineNo = line.number;
          let hasActive = false;
          for (let n = openLine.lineNo; n <= closeLineNo; n++) {
            if (activeLines.has(n)) {
              hasActive = true;
              break;
            }
          }

          if (!hasActive) {
            builder.add(
              openLine.from,
              line.to,
              Decoration.replace({
                widget: new MathBlockWidget(content.join('\n')),
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

export const mathWidgetExtension = [
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
    '.cm6-math-widget': {
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      backgroundColor: 'var(--sidebar-bg)',
      padding: '10px 12px',
      margin: '8px 0',
      overflowX: 'auto',
    },
  }),
];
