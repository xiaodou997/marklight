import type { Editor as TiptapEditor } from '@tiptap/vue-3';

export interface EditorOutlineItem {
  level: number;
  text: string;
  pos: number;
}

export interface EditorCursorInfo {
  cursor: { line: number; col: number };
  selectionText: string;
}

export function getEditorWordCount(editor: TiptapEditor): number {
  const text = editor.state.doc.textContent;
  return text.replace(/\s+/g, '').length;
}

export function extractEditorOutline(editor: TiptapEditor): EditorOutlineItem[] {
  const outline: EditorOutlineItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      outline.push({
        level: node.attrs.level,
        text: node.textContent,
        pos,
      });
    }
  });
  return outline;
}

export function getEditorCursorInfo(editor: TiptapEditor): EditorCursorInfo {
  const { from } = editor.state.selection;
  const resolved = editor.state.doc.resolve(from);
  let line = 1;

  editor.state.doc.descendants((node, nodePos) => {
    if (node.isBlock && nodePos < from) {
      line++;
    }
    return nodePos < from;
  });

  const col = from - resolved.start(resolved.depth) + 1;
  const selection = editor.state.selection;
  const selectionText = selection.empty
    ? ''
    : editor.state.doc.textBetween(selection.from, selection.to, '\n');

  return {
    cursor: { line, col },
    selectionText,
  };
}
