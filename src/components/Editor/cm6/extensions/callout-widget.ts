import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';
import { getActiveLines } from '../utils/active-lines';

// Callout 类型 → [图标, CSS class]
const CALLOUT_TYPES: Record<string, [string, string]> = {
  note:    ['ℹ️', 'mk-callout-note'],
  info:    ['ℹ️', 'mk-callout-note'],
  tip:     ['💡', 'mk-callout-tip'],
  hint:    ['💡', 'mk-callout-tip'],
  warning: ['⚠️', 'mk-callout-warning'],
  caution: ['⚠️', 'mk-callout-warning'],
  danger:  ['🚫', 'mk-callout-danger'],
  error:   ['🚫', 'mk-callout-danger'],
  success: ['✅', 'mk-callout-success'],
  check:   ['✅', 'mk-callout-success'],
  done:    ['✅', 'mk-callout-success'],
  quote:   ['💬', 'mk-callout-quote'],
  cite:    ['💬', 'mk-callout-quote'],
  example: ['📋', 'mk-callout-note'],
  abstract:['📝', 'mk-callout-note'],
};

class CalloutWidget extends WidgetType {
  constructor(
    private readonly type: string,
    private readonly title: string,
    private readonly body: string
  ) {
    super();
  }

  eq(other: CalloutWidget) {
    return this.type === other.type && this.title === other.title && this.body === other.body;
  }

  ignoreEvent(event: Event) {
    return event.type !== 'dblclick';
  }

  toDOM() {
    const [icon, cssClass] = CALLOUT_TYPES[this.type.toLowerCase()] ?? ['📌', 'mk-callout-note'];

    const wrap = document.createElement('div');
    wrap.className = `mk-callout ${cssClass}`;

    const titleRow = document.createElement('div');
    titleRow.className = 'mk-callout-title';
    titleRow.textContent = `${icon} ${this.title || this.type.charAt(0).toUpperCase() + this.type.slice(1)}`;
    wrap.appendChild(titleRow);

    if (this.body.trim()) {
      const body = document.createElement('div');
      body.className = 'mk-callout-body';
      // 简单处理行内格式（纯文本，保留换行）
      body.textContent = this.body;
      wrap.appendChild(body);
    }

    return wrap;
  }
}

/** 解析一个连续引用块，判断是否为 callout */
function tryParseCallout(lines: string[]): { type: string; title: string; body: string } | null {
  if (lines.length === 0) return null;
  const firstLine = lines[0].replace(/^(\s*>+\s?)/, '');
  const calloutMatch = firstLine.match(/^\[!([\w-]+)\]\s*(.*)/);
  if (!calloutMatch) return null;

  const type = calloutMatch[1].toLowerCase();
  const title = calloutMatch[2]?.trim() ?? '';
  const body = lines
    .slice(1)
    .map(l => l.replace(/^(\s*>+\s?)/, ''))
    .join('\n');

  return { type, title, body };
}

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const activeLines = getActiveLines(state);
  const doc = state.doc;

  let lineNo = 1;
  while (lineNo <= doc.lines) {
    const line = doc.line(lineNo);

    // 检测引用块开始
    if (!/^\s*>/.test(line.text)) {
      lineNo++;
      continue;
    }

    // 收集连续引用行
    const blockLines: string[] = [];
    const blockNums: number[] = [];
    let cur = lineNo;
    while (cur <= doc.lines) {
      const l = doc.line(cur);
      if (!/^\s*>/.test(l.text)) break;
      blockLines.push(l.text);
      blockNums.push(cur);
      cur++;
    }

    const parsed = tryParseCallout(blockLines);
    if (parsed) {
      const hasActive = blockNums.some(n => activeLines.has(n));
      if (!hasActive) {
        const startLine = doc.line(blockNums[0]);
        const endLine = doc.line(blockNums[blockNums.length - 1]);
        builder.add(
          startLine.from,
          endLine.to,
          Decoration.replace({
            widget: new CalloutWidget(parsed.type, parsed.title, parsed.body),
            inclusive: false,
            block: true,
          })
        );
      }
      lineNo = cur;
    } else {
      lineNo++;
    }
  }

  return builder.finish();
}

const calloutField = StateField.define<DecorationSet>({
  create: buildDecorations,
  update(old, tr) {
    if (tr.docChanged || tr.selection) return buildDecorations(tr.state);
    return old;
  },
  provide: f => EditorView.decorations.from(f),
});

export const calloutWidgetExtension = calloutField;
