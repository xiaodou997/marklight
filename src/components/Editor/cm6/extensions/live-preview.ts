import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate, WidgetType } from '@codemirror/view';

class PrefixWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly className: string
  ) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = this.className;
    span.textContent = this.text;
    return span;
  }
}

class TaskPrefixWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm6-task-prefix';
    span.dataset.taskToggle = '1';
    span.textContent = this.checked ? '☑ ' : '☐ ';
    return span;
  }
}

function getActiveLines(state: Parameters<typeof buildDecorations>[0]['state']): Set<number> {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number;
    const toLine = state.doc.lineAt(range.to).number;
    for (let n = fromLine; n <= toLine; n++) {
      lines.add(n);
    }
  }
  return lines;
}

function addMark(
  builder: RangeSetBuilder<Decoration>,
  from: number,
  to: number,
  className: string
) {
  if (from >= to) return;
  builder.add(from, to, Decoration.mark({ class: className }));
}

function addHidden(
  builder: RangeSetBuilder<Decoration>,
  from: number,
  to: number
) {
  if (from >= to) return;
  builder.add(from, to, Decoration.replace({}));
}

function addWidget(
  builder: RangeSetBuilder<Decoration>,
  from: number,
  to: number,
  text: string,
  className: string
) {
  if (from >= to) return;
  builder.add(from, to, Decoration.replace({ widget: new PrefixWidget(text, className) }));
}

function decorateInline(
  builder: RangeSetBuilder<Decoration>,
  lineFrom: number,
  text: string,
  active: boolean
) {
  const decoratePair = (re: RegExp, markClass: string, markLen: number) => {
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(text)) !== null) {
      const full = match[0];
      const inner = match[1] ?? '';
      const at = match.index;
      const fullFrom = lineFrom + at;
      const innerFrom = fullFrom + markLen;
      const innerTo = innerFrom + inner.length;
      const fullTo = fullFrom + full.length;

      if (active) {
        addMark(builder, fullFrom, innerFrom, 'cm6-syntax-mark');
        addMark(builder, innerTo, fullTo, 'cm6-syntax-mark');
      } else {
        addHidden(builder, fullFrom, innerFrom);
        addHidden(builder, innerTo, fullTo);
        addMark(builder, innerFrom, innerTo, markClass);
      }
    }
  };

  decoratePair(/\*\*([^*\n]+)\*\*/g, 'cm6-strong', 2);
  decoratePair(/~~([^~\n]+)~~/g, 'cm6-strikethrough', 2);
  decoratePair(/`([^`\n]+)`/g, 'cm6-inline-code', 1);

  let linkMatch: RegExpExecArray | null;
  const linkRe = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;
  while ((linkMatch = linkRe.exec(text)) !== null) {
    const at = linkMatch.index;
    const label = linkMatch[1] ?? '';
    const url = linkMatch[2] ?? '';

    const start = lineFrom + at;
    const labelFrom = start + 1;
    const labelTo = labelFrom + label.length;
    const urlFrom = labelTo + 2; // ](
    const end = urlFrom + url.length + 1; // )

    if (active) {
      addMark(builder, start, labelFrom, 'cm6-syntax-mark');
      addMark(builder, labelTo, end, 'cm6-syntax-mark');
    } else {
      addHidden(builder, start, labelFrom);
      addHidden(builder, labelTo, end);
      addMark(builder, labelFrom, labelTo, 'cm6-link');
    }
  }
}

function decorateLine(
  builder: RangeSetBuilder<Decoration>,
  lineFrom: number,
  lineTo: number,
  text: string,
  active: boolean
) {
  const headingMatch = text.match(/^(#{1,6})\s+/);
  if (headingMatch) {
    const prefixLen = headingMatch[0].length;
    const level = headingMatch[1].length;
    if (active) {
      addMark(builder, lineFrom, lineFrom + prefixLen, 'cm6-syntax-mark');
    } else {
      addHidden(builder, lineFrom, lineFrom + prefixLen);
      addMark(builder, lineFrom + prefixLen, lineTo, `cm6-heading cm6-heading-${level}`);
    }
    decorateInline(builder, lineFrom, text, active);
    return;
  }

  const quoteMatch = text.match(/^(\s*>+\s?)/);
  if (quoteMatch) {
    const prefixLen = quoteMatch[1].length;
    if (active) {
      addMark(builder, lineFrom, lineFrom + prefixLen, 'cm6-syntax-mark');
    } else {
      addWidget(builder, lineFrom, lineFrom + prefixLen, '│ ', 'cm6-quote-prefix');
      addMark(builder, lineFrom + prefixLen, lineTo, 'cm6-blockquote');
    }
    decorateInline(builder, lineFrom, text, active);
    return;
  }

  const taskMatch = text.match(/^(\s*)([-+*]\s+\[[ xX]\]\s+)/);
  if (taskMatch) {
    const indentLen = taskMatch[1].length;
    const markerLen = taskMatch[2].length;
    const checked = /\[[xX]\]/.test(taskMatch[2]);
    const start = lineFrom + indentLen;
    if (active) {
      addMark(builder, start, start + markerLen, 'cm6-syntax-mark');
    } else {
      builder.add(start, start + markerLen, Decoration.replace({ widget: new TaskPrefixWidget(checked) }));
      addMark(builder, start + markerLen, lineTo, 'cm6-list-item');
    }
    decorateInline(builder, lineFrom, text, active);
    return;
  }

  const orderedMatch = text.match(/^(\s*)(\d+[.)]\s+)/);
  if (orderedMatch) {
    const indentLen = orderedMatch[1].length;
    const marker = orderedMatch[2].trim();
    const markerLen = orderedMatch[2].length;
    const start = lineFrom + indentLen;
    if (active) {
      addMark(builder, start, start + markerLen, 'cm6-syntax-mark');
    } else {
      addWidget(builder, start, start + markerLen, `${marker} `, 'cm6-list-prefix');
      addMark(builder, start + markerLen, lineTo, 'cm6-list-item');
    }
    decorateInline(builder, lineFrom, text, active);
    return;
  }

  const bulletMatch = text.match(/^(\s*)([-+*]\s+)/);
  if (bulletMatch) {
    const indentLen = bulletMatch[1].length;
    const markerLen = bulletMatch[2].length;
    const start = lineFrom + indentLen;
    if (active) {
      addMark(builder, start, start + markerLen, 'cm6-syntax-mark');
    } else {
      addWidget(builder, start, start + markerLen, '• ', 'cm6-list-prefix');
      addMark(builder, start + markerLen, lineTo, 'cm6-list-item');
    }
    decorateInline(builder, lineFrom, text, active);
    return;
  }

  decorateInline(builder, lineFrom, text, active);
}

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const activeLines = getActiveLines(state);
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of view.visibleRanges) {
    let line = state.doc.lineAt(range.from);
    let inFence = false;
    let inMathBlock = false;
    while (line.from <= range.to) {
      const active = activeLines.has(line.number);
      const trimmed = line.text.trim();
      const isFence = /^```/.test(trimmed);
      const isMathFence = trimmed === '$$';

      if (isFence) {
        inFence = !inFence;
      }
      if (isMathFence && !inFence) {
        inMathBlock = !inMathBlock;
      }

      if (!inFence && !inMathBlock && !isFence && !isMathFence) {
        decorateLine(builder, line.from, line.to, line.text, active);
      }

      if (line.to >= range.to) break;
      line = state.doc.line(line.number + 1);
    }
  }

  return builder.finish();
}

export const livePreviewExtension = [
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
    '.cm6-syntax-mark': {
      color: '#9ca3af',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    '.cm6-heading-1': { fontSize: '2.25rem', fontWeight: '800' },
    '.cm6-heading-2': { fontSize: '1.875rem', fontWeight: '700' },
    '.cm6-heading-3': { fontSize: '1.5rem', fontWeight: '600' },
    '.cm6-heading-4': { fontSize: '1.25rem', fontWeight: '600' },
    '.cm6-heading-5': { fontSize: '1.125rem', fontWeight: '600' },
    '.cm6-heading-6': { fontSize: '1rem', fontWeight: '600' },
    '.cm6-strong': { fontWeight: '700' },
    '.cm6-strikethrough': { textDecoration: 'line-through' },
    '.cm6-inline-code': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      backgroundColor: 'var(--sidebar-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: '4px',
      padding: '0 2px',
    },
    '.cm6-link': {
      color: 'var(--primary-color)',
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
    },
    '.cm6-quote-prefix': {
      color: '#9ca3af',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    '.cm6-blockquote': {
      color: '#6b7280',
    },
    '.cm6-list-prefix': {
      color: '#6b7280',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    '.cm6-list-item': {
      color: 'var(--text-color)',
    },
  }),
];
