import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';
import katex from 'katex';
import 'katex/dist/katex.min.css';

class MathBlockWidget extends WidgetType {
  constructor(private readonly latex: string) {
    super();
  }

  eq(other: MathBlockWidget) {
    return this.latex === other.latex;
  }

  ignoreEvent() { return false; }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'mk-math-widget';
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
  let openLine: { from: number; lineNo: number } | null = null;
  let content: string[] = [];

  while (line.number <= doc.lines) {
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
          const replTo = line.number < doc.lines ? doc.line(line.number + 1).from : line.to;
          builder.add(
            openLine.from,
            replTo,
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

    if (line.number >= doc.lines) break;
    line = doc.line(line.number + 1);
  }

  return builder.finish();
}

const mathBlockField = StateField.define<DecorationSet>({
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

export const mathWidgetExtension = [
  mathBlockField,
  EditorView.baseTheme({
    '.mk-math-widget': {
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      backgroundColor: 'var(--sidebar-bg)',
      padding: '10px 12px',
      margin: '8px 0',
      overflowX: 'auto',
    },
  }),
];
