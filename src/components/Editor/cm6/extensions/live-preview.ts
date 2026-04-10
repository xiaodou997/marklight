import { type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { getActiveLines } from '../utils/active-lines';
import { decorateLine } from '../decorators/block';

/**
 * 扫描文档从第 1 行到 beforeLineNumber-1 行，计算在指定行开始时的围栏状态。
 * 防止 visibleRanges 从代码块中间开始时 inFence 被错误初始化为 false。
 */
function computeFenceState(state: EditorView['state'], beforeLineNumber: number): { inFence: boolean; inMathBlock: boolean } {
  let inFence = false;
  let inMathBlock = false;
  for (let n = 1; n < beforeLineNumber; n++) {
    const text = state.doc.line(n).text.trim();
    if (/^```/.test(text)) inFence = !inFence;
    if (text === '$$' && !inFence) inMathBlock = !inMathBlock;
  }
  return { inFence, inMathBlock };
}

function buildDecorations(view: EditorView): DecorationSet {
  try {
    const { state } = view;
    const activeLines = getActiveLines(state);
    const decos: Range<Decoration>[] = [];

    for (const range of view.visibleRanges) {
      let line = state.doc.lineAt(range.from);
      const startState = computeFenceState(state, line.number);
      let inFence = startState.inFence;
      let inMathBlock = startState.inMathBlock;
      while (line.from <= range.to) {
        const active = activeLines.has(line.number);
        const trimmed = line.text.trim();
        const isFence = /^```/.test(trimmed);
        const isMathFence = trimmed === '$$';

        if (isFence) inFence = !inFence;
        if (isMathFence && !inFence) inMathBlock = !inMathBlock;

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

export const livePreviewExtension = ViewPlugin.fromClass(class {
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
});
