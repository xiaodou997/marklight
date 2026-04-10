import { EditorView } from '@codemirror/view';

export const taskToggleExtension = EditorView.domEventHandlers({
  click(event, view) {
    const target = event.target as HTMLElement | null;
    if (!target) return false;

    // 支持点击 label 或 input 本身
    const label = target.closest('[data-task-toggle]') as HTMLElement | null;
    if (!label) return false;

    const pos = view.posAtDOM(label, 0);
    const line = view.state.doc.lineAt(pos);
    const match = line.text.match(/^(\s*[-+*]\s+\[)([ xX])(\]\s+)/);
    if (!match) return false;

    event.preventDefault();
    const toggled = match[2].toLowerCase() === 'x' ? ' ' : 'x';
    const replaceFrom = line.from + match[1].length;
    const replaceTo = replaceFrom + 1;
    view.dispatch({
      changes: { from: replaceFrom, to: replaceTo, insert: toggled },
      selection: { anchor: line.from + line.text.length },
    });
    view.focus();
    return true;
  },
});
