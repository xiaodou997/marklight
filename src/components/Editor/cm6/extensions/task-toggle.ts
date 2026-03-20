import { EditorView } from '@codemirror/view';

export const taskToggleExtension = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement | null;
    if (!target || !target.dataset.taskToggle) return false;
    const pos = view.posAtDOM(target, 0);
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
