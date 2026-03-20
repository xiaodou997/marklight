import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate, WidgetType } from '@codemirror/view';

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

class TableWidget extends WidgetType {
  constructor(private readonly table: ParsedTable) {
    super();
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm6-table-widget';

    const tableEl = document.createElement('table');
    tableEl.className = 'cm6-table';

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const header of this.table.headers) {
      const th = document.createElement('th');
      th.textContent = header;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of this.table.rows) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tableEl.appendChild(tbody);

    wrap.appendChild(tableEl);
    return wrap;
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

function splitTableLine(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(part => part.trim());
}

function isSeparatorLine(line: string): boolean {
  const cells = splitTableLine(line);
  if (cells.length === 0) return false;
  return cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function tryParseTable(lines: string[]): ParsedTable | null {
  if (lines.length < 2) return null;
  const head = lines[0];
  const sep = lines[1];
  if (!head.includes('|') || !sep.includes('|') || !isSeparatorLine(sep)) return null;
  const headers = splitTableLine(head);
  if (headers.length === 0) return null;
  const rows = lines.slice(2).filter(Boolean).map(splitTableLine);
  return { headers, rows };
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { state } = view;
  const activeLines = getActiveLines(state);

  for (const range of view.visibleRanges) {
    let line = state.doc.lineAt(range.from);
    while (line.from <= range.to) {
      if (!line.text.includes('|')) {
        if (line.to >= range.to) break;
        line = state.doc.line(line.number + 1);
        continue;
      }

      const blockLines: string[] = [];
      const blockNumbers: number[] = [];
      let endLine = line;
      while (endLine.text.includes('|')) {
        blockLines.push(endLine.text);
        blockNumbers.push(endLine.number);
        if (endLine.to >= range.to) break;
        const next = state.doc.line(endLine.number + 1);
        if (!next.text.includes('|')) break;
        endLine = next;
      }

      const parsed = tryParseTable(blockLines);
      if (parsed) {
        const hasActive = blockNumbers.some(n => activeLines.has(n));
        if (!hasActive) {
          builder.add(
            line.from,
            endLine.to,
            Decoration.replace({
              widget: new TableWidget(parsed),
              inclusive: false,
            })
          );
        }
      }

      if (endLine.to >= range.to) break;
      line = state.doc.line(endLine.number + 1);
    }
  }

  return builder.finish();
}

export const tableWidgetExtension = [
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
    '.cm6-table-widget': {
      margin: '10px 0',
      overflowX: 'auto',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
    },
    '.cm6-table': {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: 'var(--bg-color)',
    },
    '.cm6-table th': {
      backgroundColor: 'var(--sidebar-bg)',
      borderBottom: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      textAlign: 'left',
      padding: '8px 10px',
      fontWeight: '600',
    },
    '.cm6-table td': {
      borderTop: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      padding: '8px 10px',
      verticalAlign: 'top',
    },
    '.cm6-table th:last-child, .cm6-table td:last-child': {
      borderRight: 'none',
    },
  }),
];
