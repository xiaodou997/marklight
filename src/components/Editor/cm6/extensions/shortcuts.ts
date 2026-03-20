import { EditorSelection, type Extension } from '@codemirror/state';
import { redo, undo } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { DEFAULT_SHORTCUTS } from '../../../../utils/shortcuts';

type ShortcutMap = Record<string, string>;

type Cmd = (view: any) => boolean;

function wrapSelection(view: any, left: string, right = left): boolean {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const insert = `${left}${selected}${right}`;
  const anchor = range.from + left.length;
  const head = anchor + selected.length;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.single(anchor, head),
  });
  return true;
}

function replaceSelectedLines(view: any, mapper: (lineText: string, index: number) => string): boolean {
  const { state } = view;
  const main = state.selection.main;
  const fromLine = state.doc.lineAt(main.from);
  const toLine = state.doc.lineAt(main.to);
  const changes: Array<{ from: number; to: number; insert: string }> = [];
  let idx = 0;
  for (let number = fromLine.number; number <= toLine.number; number++) {
    const line = state.doc.line(number);
    const mapped = mapper(line.text, idx++);
    if (mapped !== line.text) {
      changes.push({ from: line.from, to: line.to, insert: mapped });
    }
  }
  if (changes.length === 0) return true;
  view.dispatch({ changes });
  return true;
}

function setHeading(level: number): Cmd {
  return (view) => replaceSelectedLines(view, (line) => {
    const body = line.replace(/^#{1,6}\s+/, '');
    if (level === 0) return body;
    return `${'#'.repeat(level)} ${body}`;
  });
}

function togglePrefix(prefix: string): Cmd {
  return (view) => replaceSelectedLines(view, (line) => {
    if (line.startsWith(prefix)) return line.slice(prefix.length);
    return `${prefix}${line}`;
  });
}

const commandById: Record<string, Cmd> = {
  bold: (view) => wrapSelection(view, '**'),
  italic: (view) => wrapSelection(view, '*'),
  strikethrough: (view) => wrapSelection(view, '~~'),
  code: (view) => wrapSelection(view, '`'),
  highlight: (view) => wrapSelection(view, '=='),
  heading1: setHeading(1),
  heading2: setHeading(2),
  heading3: setHeading(3),
  heading4: setHeading(4),
  heading5: setHeading(5),
  heading6: setHeading(6),
  paragraph: setHeading(0),
  orderedList: (view) => replaceSelectedLines(view, (line, i) => `${i + 1}. ${line.replace(/^\s*(?:\d+[.)]\s+|[-+*]\s+|\[[ xX]\]\s+)/, '')}`),
  bulletList: (view) => togglePrefix('- ')(view),
  taskList: (view) => replaceSelectedLines(view, (line) => {
    if (/^\s*[-+*]\s+\[[ xX]\]\s+/.test(line)) return line.replace(/^\s*[-+*]\s+\[[ xX]\]\s+/, '');
    return `- [ ] ${line.replace(/^\s*[-+*]\s+/, '')}`;
  }),
  blockquote: (view) => togglePrefix('> ')(view),
  codeBlock: (view) => {
    const { state } = view;
    const range = state.selection.main;
    const selected = state.sliceDoc(range.from, range.to);
    const insert = `\`\`\`\n${selected}\n\`\`\``;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: EditorSelection.single(range.from + 4, range.from + 4 + selected.length),
    });
    return true;
  },
  undo: (view) => undo(view),
  redo: (view) => redo(view),
};

function effectiveKeyMap(customShortcuts?: ShortcutMap) {
  return DEFAULT_SHORTCUTS.map(item => ({
    id: item.id,
    key: customShortcuts?.[item.id] || item.key,
  }));
}

export function createCm6ShortcutsExtension(customShortcuts?: ShortcutMap): Extension {
  const bindings = effectiveKeyMap(customShortcuts)
    .map(({ id, key }) => {
      const run = commandById[id];
      if (!run) return null;
      return { key, run };
    })
    .filter((item): item is { key: string; run: Cmd } => Boolean(item));
  return keymap.of(bindings);
}
