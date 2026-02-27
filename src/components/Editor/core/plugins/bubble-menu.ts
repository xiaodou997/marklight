import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { toggleMark, setBlockType } from 'prosemirror-commands';

export const bubbleMenuKey = new PluginKey('bubble-menu');

export const createBubbleMenuPlugin = (schema: Schema, updateCb: (show: boolean, left: number, top: number, marks: any, linkHref?: string) => void) => {
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
          
          // 获取当前链接的 href
          let linkHref: string | undefined;
          const linkMark = schema.marks.link?.isInSet(storedOrCurrent);
          if (linkMark) {
            linkHref = linkMark.attrs?.href;
          }
          
          const marks = {
            bold: !!schema.marks.strong.isInSet(storedOrCurrent),
            italic: !!schema.marks.em.isInSet(storedOrCurrent),
            code: !!schema.marks.code.isInSet(storedOrCurrent),
            link: !!linkMark,
          };

          updateCb(true, left, top, marks, linkHref);
        }
      };
    }
  });
};

export const handleMenuAction = (view: EditorView, type: string, schema: Schema, data?: any) => {
  const { state, dispatch } = view;
  switch (type) {
    case 'bold': toggleMark(schema.marks.strong)(state, dispatch); break;
    case 'italic': toggleMark(schema.marks.em)(state, dispatch); break;
    case 'code': toggleMark(schema.marks.code)(state, dispatch); break;
    case 'h1': setBlockType(schema.nodes.heading, { level: 1 })(state, dispatch); break;
    case 'h2': setBlockType(schema.nodes.heading, { level: 2 })(state, dispatch); break;
    case 'link': {
      if (data?.href && schema.marks.link) {
        toggleMark(schema.marks.link, { href: data.href })(state, dispatch);
      }
      break;
    }
    case 'unlink': {
      if (schema.marks.link) {
        // 移除链接标记
        const { from, to } = state.selection;
        const tr = state.tr.removeMark(from, to, schema.marks.link);
        dispatch(tr);
      }
      break;
    }
  }
  view.focus();
};