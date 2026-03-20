import type { EditorView } from '@codemirror/view';

type BubbleMarks = {
  bold: boolean;
  italic: boolean;
  code: boolean;
  link: boolean;
};

type BubbleState = {
  show: boolean;
  left: number;
  top: number;
  marks: BubbleMarks;
  linkHref?: string;
};

type LinkMatch = {
  from: number;
  to: number;
  labelFrom: number;
  labelTo: number;
  href: string;
  label: string;
};

function hasWrap(view: EditorView, from: number, to: number, left: string, right = left): boolean {
  if (from < left.length) return false;
  if (to + right.length > view.state.doc.length) return false;
  const before = view.state.sliceDoc(from - left.length, from);
  const after = view.state.sliceDoc(to, to + right.length);
  return before === left && after === right;
}

function findLinkAroundSelection(view: EditorView, from: number, to: number): LinkMatch | null {
  const docLen = view.state.doc.length;
  const windowFrom = Math.max(0, from - 1024);
  const windowTo = Math.min(docLen, to + 2048);
  const chunk = view.state.sliceDoc(windowFrom, windowTo);
  const re = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(chunk)) !== null) {
    const full = match[0];
    const label = match[1] ?? '';
    const href = match[2] ?? '';
    const fullFrom = windowFrom + match.index;
    const labelFrom = fullFrom + 1;
    const labelTo = labelFrom + label.length;
    const fullTo = fullFrom + full.length;
    if (from >= labelFrom && to <= labelTo) {
      return { from: fullFrom, to: fullTo, labelFrom, labelTo, href, label };
    }
  }
  return null;
}

function wrapSelection(view: EditorView, left: string, right = left): boolean {
  const range = view.state.selection.main;
  const from = range.from;
  const to = range.to;
  if (from === to) {
    const insert = `${left}${right}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + left.length },
    });
    return true;
  }

  if (hasWrap(view, from, to, left, right)) {
    view.dispatch({
      changes: [
        { from: to, to: to + right.length, insert: '' },
        { from: from - left.length, to: from, insert: '' },
      ],
      selection: {
        anchor: from - left.length,
        head: to - left.length - right.length,
      },
    });
    return true;
  }

  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${left}${selected}${right}` },
    selection: { anchor: from + left.length, head: to + left.length },
  });
  return true;
}

function replaceSelectedLines(view: EditorView, mapper: (lineText: string) => string): boolean {
  const { state } = view;
  const main = state.selection.main;
  const fromLine = state.doc.lineAt(main.from);
  const toLine = state.doc.lineAt(main.to);
  const changes: Array<{ from: number; to: number; insert: string }> = [];

  for (let n = fromLine.number; n <= toLine.number; n++) {
    const line = state.doc.line(n);
    const mapped = mapper(line.text);
    if (mapped !== line.text) {
      changes.push({ from: line.from, to: line.to, insert: mapped });
    }
  }
  if (changes.length === 0) return true;
  view.dispatch({ changes });
  return true;
}

function setHeading(view: EditorView, level: number): boolean {
  return replaceSelectedLines(view, (line) => {
    const body = line.replace(/^#{1,6}\s+/, '');
    return level > 0 ? `${'#'.repeat(level)} ${body}` : body;
  });
}

function applyLink(view: EditorView, href?: string): boolean {
  const link = (href || '').trim();
  if (!link) return true;

  const range = view.state.selection.main;
  const from = range.from;
  const to = range.to;

  if (from === to) {
    const text = `[${link}](${link})`;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + 1, head: from + 1 + link.length },
    });
    return true;
  }

  const around = findLinkAroundSelection(view, from, to);
  if (around) {
    view.dispatch({
      changes: { from: around.labelTo + 2, to: around.to - 1, insert: link },
      selection: { anchor: around.labelFrom, head: around.labelTo },
    });
    return true;
  }

  const selected = view.state.sliceDoc(from, to);
  const text = `[${selected}](${link})`;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + 1, head: from + 1 + selected.length },
  });
  return true;
}

function removeLink(view: EditorView): boolean {
  const range = view.state.selection.main;
  const around = findLinkAroundSelection(view, range.from, range.to);
  if (!around) return true;
  const anchor = around.from;
  const head = around.from + around.label.length;
  view.dispatch({
    changes: { from: around.from, to: around.to, insert: around.label },
    selection: { anchor, head },
  });
  return true;
}

export function getCm6BubbleMenuState(view: EditorView): BubbleState {
  const range = view.state.selection.main;
  if (range.empty || !view.hasFocus) {
    return {
      show: false,
      left: 0,
      top: 0,
      marks: { bold: false, italic: false, code: false, link: false },
    };
  }

  const from = range.from;
  const to = range.to;
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  if (!start || !end) {
    return {
      show: false,
      left: 0,
      top: 0,
      marks: { bold: false, italic: false, code: false, link: false },
    };
  }

  const aroundLink = findLinkAroundSelection(view, from, to);
  return {
    show: true,
    left: (start.left + end.left) / 2,
    top: start.top,
    marks: {
      bold: hasWrap(view, from, to, '**'),
      italic: hasWrap(view, from, to, '*'),
      code: hasWrap(view, from, to, '`'),
      link: Boolean(aroundLink),
    },
    linkHref: aroundLink?.href,
  };
}

export function handleCm6BubbleMenuAction(
  view: EditorView,
  type: string,
  data?: { href?: string }
): boolean {
  switch (type) {
    case 'bold':
      return wrapSelection(view, '**');
    case 'italic':
      return wrapSelection(view, '*');
    case 'code':
      return wrapSelection(view, '`');
    case 'h1':
      return setHeading(view, 1);
    case 'h2':
      return setHeading(view, 2);
    case 'link':
      return applyLink(view, data?.href);
    case 'unlink':
      return removeLink(view);
    default:
      return false;
  }
}
