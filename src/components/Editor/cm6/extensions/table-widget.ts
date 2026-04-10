import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';
import { getActiveLines } from '../utils/active-lines';

type ParsedTable = {
  headers: string[];
  rows: string[][];
  /** 每行在文档中的起始位置（行号，从1开始） */
  lineNumbers: number[];
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
    wrap.dataset.tableStartLine = String(this.table.lineNumbers[0]);

    const tableEl = document.createElement('table');
    tableEl.className = 'mk-table';

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    this.table.headers.forEach((header, col) => {
      const th = document.createElement('th');
      th.dataset.row = '0';
      th.dataset.col = String(col);
      renderInlineMarkdown(header, th);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.table.rows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      row.forEach((cell, col) => {
        const td = document.createElement('td');
        // data-row: 0=header, 1=first body row (对应 markdown 第3行, 即 lineNumbers[2])
        td.dataset.row = String(rowIdx + 1);
        td.dataset.col = String(col);
        renderInlineMarkdown(cell, td);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);

    wrap.appendChild(tableEl);
    return wrap;
  }
}

/** 渲染单元格中的行内 Markdown（行内代码、加粗、斜体） */
function renderInlineMarkdown(text: string, container: HTMLElement) {
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

function tryParseTable(lines: string[], lineNumbers: number[]): ParsedTable | null {
  if (lines.length < 2) return null;
  const head = lines[0];
  const sep = lines[1];
  if (!head.includes('|') || !sep.includes('|') || !isSeparatorLine(sep)) return null;
  const headers = splitTableLine(head);
  if (headers.length === 0) return null;
  const rows = lines.slice(2).filter(Boolean).map(splitTableLine);
  return { headers, rows, lineNumbers };
}

/**
 * 根据点击的 data-row / data-col 计算目标文档位置（对应 markdown 单元格内容）
 */
function findCellPos(state: EditorState, tableStartLineNo: number, rowIndex: number, colIndex: number): number {
  // rowIndex: 0=header行(第1行), 1+=body行(第3行起，跳过分隔符行)
  const targetLineNo = rowIndex === 0
    ? tableStartLineNo               // header
    : tableStartLineNo + rowIndex + 1; // +1 跳过分隔符行

  if (targetLineNo > state.doc.lines) return state.doc.length;
  const line = state.doc.line(targetLineNo);
  const text = line.text;

  // 找到第 colIndex 个单元格内容的起始位置
  let pipeCount = 0;
  let cellStart = 0;
  // 跳过行首可能的 |
  let i = text.startsWith('|') ? 1 : 0;
  while (i < text.length) {
    if (text[i] === '|') {
      pipeCount++;
      if (pipeCount > colIndex) break;
      cellStart = i + 1;
    }
    i++;
  }
  // 跳过前导空格
  while (cellStart < text.length && text[cellStart] === ' ') cellStart++;
  return line.from + cellStart;
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

    const parsed = tryParseTable(blockLines, blockNumbers);
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

/** 点击表格单元格时精确跳转到对应的 markdown 源码位置 */
const tableCellClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    const target = event.target as Element;
    const cell = target.closest('td[data-row], th[data-row]') as HTMLElement | null;
    if (!cell) return false;

    const row = parseInt(cell.dataset.row ?? '-1');
    const col = parseInt(cell.dataset.col ?? '-1');
    if (row < 0 || col < 0) return false;

    // 从 widget wrapper 上读取预先存好的起始行号，避免 posAtDOM 在 widget 元素上不可靠
    const wrapper = target.closest('.mk-table-widget') as HTMLElement | null;
    const tableStartLine = wrapper
      ? parseInt(wrapper.dataset.tableStartLine ?? '0')
      : (() => {
          // 兜底：通过坐标估算位置
          const coords = { x: event.clientX, y: event.clientY };
          const pos = view.posAtCoords(coords, false);
          return pos != null ? view.state.doc.lineAt(pos).number : 1;
        })();

    if (!tableStartLine) return false;

    const targetPos = findCellPos(view.state, tableStartLine, row, col);
    view.dispatch({ selection: { anchor: targetPos } });
    view.focus();
    return true;
  },
});

export const tableWidgetExtension = [tableField, tableCellClickHandler];
