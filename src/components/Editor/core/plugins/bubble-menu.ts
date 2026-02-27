import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { toggleMark, setBlockType } from 'prosemirror-commands';

export const bubbleMenuKey = new PluginKey('bubble-menu');

export const createBubbleMenuPlugin = (schema: Schema, updateCb: (show: boolean, left: number, top: number, marks: any) => void) => {
  return new Plugin({
    key: bubbleMenuKey,
    view() {
      return {
        update(view, prevState) {
          const { state } = view;

          if (state.selection.empty) {
            updateCb(false, 0, 0, {});
            return;
          }

          if (prevState && prevState.doc.eq(state.doc) && prevState.selection.eq(state.selection)) {
            return;
          }

          const { from, to } = state.selection;
          const start = view.coordsAtPos(from);
          const end = view.coordsAtPos(to);

          const left = (start.left + end.left) / 2;
          const top = start.top;

          // 使用 resolve 获取选区起始点的标记
          const $from = state.doc.resolve(from);
          const storedOrCurrent = state.storedMarks || $from.marks();
          const marks = {
            bold: !!schema.marks.strong.isInSet(storedOrCurrent),
            italic: !!schema.marks.em.isInSet(storedOrCurrent),
            code: !!schema.marks.code.isInSet(storedOrCurrent),
          };

          updateCb(true, left, top, marks);
        }
      };
    }
  });
};

export const handleMenuAction = (view: EditorView, type: string, schema: Schema) => {
  const { state, dispatch } = view;
  switch (type) {
    case 'bold': toggleMark(schema.marks.strong)(state, dispatch); break;
    case 'italic': toggleMark(schema.marks.em)(state, dispatch); break;
    case 'code': toggleMark(schema.marks.code)(state, dispatch); break;
    case 'h1': setBlockType(schema.nodes.heading, { level: 1 })(state, dispatch); break;
    case 'h2': setBlockType(schema.nodes.heading, { level: 2 })(state, dispatch); break;
  }
  view.focus();
};
