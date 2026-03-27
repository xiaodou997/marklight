import { type Range } from '@codemirror/state';
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

  eq(other: PrefixWidget) {
    return this.text === other.text && this.className === other.className;
  }
}

class TaskPrefixWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'mk-task-prefix';
    span.dataset.taskToggle = '1';
    span.textContent = this.checked ? '☑ ' : '☐ ';
    return span;
  }

  eq(other: TaskPrefixWidget) {
    return this.checked === other.checked;
  }
}

class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('span');
    hr.className = 'mk-hr-widget';
    return hr;
  }

  eq() {
    return true;
  }
}

function getActiveLines(state: EditorView['state']): Set<number> {
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

// ── 辅助函数：往数组 push decoration（不要求顺序） ──

function addMark(
  out: Range<Decoration>[],
  from: number,
  to: number,
  className: string
) {
  if (from >= to) return;
  out.push(Decoration.mark({ class: className }).range(from, to));
}

function addHidden(
  out: Range<Decoration>[],
  from: number,
  to: number
) {
  if (from >= to) return;
  out.push(Decoration.replace({}).range(from, to));
}

function addWidget(
  out: Range<Decoration>[],
  from: number,
  to: number,
  text: string,
  className: string
) {
  if (from >= to) return;
  out.push(Decoration.replace({ widget: new PrefixWidget(text, className) }).range(from, to));
}

function addReplacementWidget(
  out: Range<Decoration>[],
  from: number,
  to: number,
  widget: WidgetType
) {
  if (from >= to) return;
  out.push(Decoration.replace({ widget }).range(from, to));
}

function decorateInline(
  out: Range<Decoration>[],
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
        addMark(out, fullFrom, innerFrom, 'mk-syntax-mark');
        addMark(out, innerTo, fullTo, 'mk-syntax-mark');
      } else {
        addHidden(out, fullFrom, innerFrom);
        addMark(out, innerFrom, innerTo, markClass);
        addHidden(out, innerTo, fullTo);
      }
    }
  };

  decoratePair(/\*\*([^*\n]+)\*\*/g, 'mk-strong', 2);
  decoratePair(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, 'mk-emphasis', 1);
  decoratePair(/~~([^~\n]+)~~/g, 'mk-strikethrough', 2);
  decoratePair(/(?<!~)~([^~\n]+)~(?!~)/g, 'mk-sub', 1);
  decoratePair(/\^([^^\n]+)\^/g, 'mk-sup', 1);
  decoratePair(/`([^`\n]+)`/g, 'mk-inline-code', 1);
  decoratePair(/==([^=\n]+)==/g, 'mk-highlight', 2);

  let linkMatch: RegExpExecArray | null;
  const linkRe = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;
  while ((linkMatch = linkRe.exec(text)) !== null) {
    if (linkMatch.index > 0 && text[linkMatch.index - 1] === '!') {
      continue;
    }
    const at = linkMatch.index;
    const label = linkMatch[1] ?? '';
    const url = linkMatch[2] ?? '';

    const start = lineFrom + at;
    const labelFrom = start + 1;
    const labelTo = labelFrom + label.length;
    const urlFrom = labelTo + 2; // ](
    const end = urlFrom + url.length + 1; // )

    if (active) {
      addMark(out, start, labelFrom, 'mk-syntax-mark');
      addMark(out, labelTo, end, 'mk-syntax-mark');
    } else {
      addHidden(out, start, labelFrom);
      addMark(out, labelFrom, labelTo, 'mk-link');
      addHidden(out, labelTo, end);
    }
  }
}

function decorateLine(
  out: Range<Decoration>[],
  lineFrom: number,
  lineTo: number,
  text: string,
  active: boolean
) {
  const isHr = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text);
  if (isHr) {
    if (active) {
      addMark(out, lineFrom, lineTo, 'mk-syntax-mark');
    } else {
      addReplacementWidget(out, lineFrom, lineTo, new HorizontalRuleWidget());
    }
    return;
  }

  const headingMatch = text.match(/^(#{1,6})\s+/);
  if (headingMatch) {
    const prefixLen = headingMatch[0].length;
    const level = headingMatch[1].length;
    if (active) {
      addMark(out, lineFrom, lineFrom + prefixLen, `mk-syntax-mark mk-heading mk-heading-${level}`);
      addMark(out, lineFrom + prefixLen, lineTo, `mk-heading mk-heading-${level}`);
    } else {
      addHidden(out, lineFrom, lineFrom + prefixLen);
      addMark(out, lineFrom + prefixLen, lineTo, `mk-heading mk-heading-${level}`);
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  const quoteMatch = text.match(/^(\s*>+\s?)/);
  if (quoteMatch) {
    const prefixLen = quoteMatch[1].length;
    if (active) {
      addMark(out, lineFrom, lineFrom + prefixLen, 'mk-syntax-mark');
    } else {
      out.push(Decoration.line({ class: 'mk-blockquote-line' }).range(lineFrom));
      addHidden(out, lineFrom, lineFrom + prefixLen);
      addMark(out, lineFrom + prefixLen, lineTo, 'mk-blockquote');
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  const taskMatch = text.match(/^(\s*)([-+*]\s+\[[ xX]\]\s+)/);
  if (taskMatch) {
    const indentLen = taskMatch[1].length;
    const markerLen = taskMatch[2].length;
    const checked = /\[[xX]\]/.test(taskMatch[2]);
    const start = lineFrom + indentLen;
    if (active) {
      addMark(out, start, start + markerLen, 'mk-syntax-mark');
    } else {
      out.push(Decoration.replace({ widget: new TaskPrefixWidget(checked) }).range(start, start + markerLen));
      addMark(out, start + markerLen, lineTo, 'mk-list-item');
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  const orderedMatch = text.match(/^(\s*)(\d+[.)]\s+)/);
  if (orderedMatch) {
    const indentLen = orderedMatch[1].length;
    const marker = orderedMatch[2].trim();
    const markerLen = orderedMatch[2].length;
    const start = lineFrom + indentLen;
    if (active) {
      addMark(out, start, start + markerLen, 'mk-syntax-mark');
    } else {
      addWidget(out, start, start + markerLen, `${marker} `, 'mk-list-prefix');
      addMark(out, start + markerLen, lineTo, 'mk-list-item');
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  const bulletMatch = text.match(/^(\s*)([-+*]\s+)/);
  if (bulletMatch) {
    const indentLen = bulletMatch[1].length;
    const markerLen = bulletMatch[2].length;
    const marker = bulletMatch[2].trim();
    const start = lineFrom + indentLen;
    if (active) {
      addMark(out, start, start + markerLen, 'mk-syntax-mark');
    } else {
      addWidget(out, start, start + markerLen, `${marker} `, 'mk-list-prefix');
      addMark(out, start + markerLen, lineTo, 'mk-list-item');
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  decorateInline(out, lineFrom, text, active);
}

function buildDecorations(view: EditorView): DecorationSet {
  try {
    const { state } = view;
    const activeLines = getActiveLines(state);
    const decos: Range<Decoration>[] = [];

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
          decorateLine(decos, line.from, line.to, line.text, active);
        }

        if (line.to >= range.to) break;
        line = state.doc.line(line.number + 1);
      }
    }

    return Decoration.set(decos, true);
  } catch (e) {
    console.error('[live-preview] buildDecorations failed:', e);
    return Decoration.none;
  }
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
    '.mk-syntax-mark': {
      color: '#9ca3af',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    '.mk-heading-1': { fontSize: '2.25rem', fontWeight: '800', textDecoration: 'none' },
    '.mk-heading-2': { fontSize: '1.875rem', fontWeight: '700', textDecoration: 'none' },
    '.mk-heading-3': { fontSize: '1.5rem', fontWeight: '600', textDecoration: 'none' },
    '.mk-heading-4': { fontSize: '1.25rem', fontWeight: '600', textDecoration: 'none' },
    '.mk-heading-5': { fontSize: '1.125rem', fontWeight: '600', textDecoration: 'none' },
    '.mk-heading-6': { fontSize: '1rem', fontWeight: '600', textDecoration: 'none' },
    '.mk-strong': { fontWeight: '700' },
    '.mk-emphasis': { fontStyle: 'italic' },
    '.mk-strikethrough': { textDecoration: 'line-through' },
    '.mk-sub': {
      fontSize: '0.75em',
      verticalAlign: 'sub',
    },
    '.mk-sup': {
      fontSize: '0.75em',
      verticalAlign: 'super',
    },
    '.mk-highlight': {
      backgroundColor: '#fef08a',
      borderRadius: '3px',
      padding: '0 1px',
    },
    '.mk-inline-code': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      backgroundColor: 'var(--sidebar-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: '4px',
      padding: '0 2px',
    },
    '.mk-link': {
      color: 'var(--primary-color)',
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
    },
    '.mk-blockquote-line': {
      borderLeft: '3px solid #d1d5db',
      paddingLeft: '12px',
    },
    '.mk-blockquote': {
      color: '#6b7280',
    },
    '.mk-list-prefix': {
      color: '#6b7280',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    '.mk-list-item': {
      color: 'var(--text-color)',
    },
    '.mk-hr-widget': {
      display: 'block',
      width: '100%',
      borderTop: '1px solid var(--border-color)',
      marginTop: '0.5em',
      marginBottom: '0.5em',
      height: '0',
    },
  }),
];
