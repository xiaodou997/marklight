import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

class TableWidget extends WidgetType {
  constructor(private readonly table: ParsedTable) {
    super();
  }

  eq(other: TableWidget) {
    return JSON.stringify(this.table) === JSON.stringify(other.table);
  }

  ignoreEvent() { return false; }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'mk-table-widget';

    const tableEl = document.createElement('table');
    tableEl.className = 'mk-table';

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const header of this.table.headers) {
      const th = document.createElement('th');
      renderInlineMarkdown(header, th);
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of this.table.rows) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        renderInlineMarkdown(cell, td);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tableEl.appendChild(tbody);

    wrap.appendChild(tableEl);
    return wrap;
  }
}

/** 渲染单元格中的行内 Markdown（行内代码、加粗、斜体） */
function renderInlineMarkdown(text: string, container: HTMLElement) {
  // 按行内代码、加粗、斜体分割，保留分隔符
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  for (const part of parts) {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const code = document.createElement('code');
      code.className = 'mk-inline-code';
      code.textContent = part.slice(1, -1);
      container.appendChild(code);
    } else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const b = document.createElement('strong');
      b.textContent = part.slice(2, -2);
      container.appendChild(b);
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const em = document.createElement('em');
      em.textContent = part.slice(1, -1);
      container.appendChild(em);
    } else if (part) {
      container.appendChild(document.createTextNode(part));
    }
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

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const activeLines = getActiveLines(state);
  const doc = state.doc;

  let line = doc.line(1);
  while (line.number <= doc.lines) {
    if (!line.text.includes('|')) {
      if (line.number >= doc.lines) break;
      line = doc.line(line.number + 1);
      continue;
    }

    const blockLines: string[] = [];
    const blockNumbers: number[] = [];
    let endLine = line;
    while (endLine.text.includes('|')) {
      blockLines.push(endLine.text);
      blockNumbers.push(endLine.number);
      if (endLine.number >= doc.lines) break;
      const next = doc.line(endLine.number + 1);
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

    if (endLine.number >= doc.lines) break;
    line = doc.line(endLine.number + 1);
  }

  return builder.finish();
}

const tableField = StateField.define<DecorationSet>({
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

export const tableWidgetExtension = [
  tableField,
  EditorView.baseTheme({
    '.mk-table-widget': {
      margin: '10px 0',
      overflowX: 'auto',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
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
      padding: '8px 10px',
      fontWeight: '600',
    },
    '.mk-table td': {
      borderTop: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      padding: '8px 10px',
      verticalAlign: 'top',
    },
    '.mk-table th:last-child, .mk-table td:last-child': {
      borderRight: 'none',
    },
  }),
];
