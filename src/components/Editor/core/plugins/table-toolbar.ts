import { Plugin, PluginKey } from 'prosemirror-state';
import { 
  addColumnBefore, addColumnAfter, deleteColumn,
  addRowBefore, addRowAfter, deleteRow,
  deleteTable
} from 'prosemirror-tables';
import { EditorView } from 'prosemirror-view';

export const tableToolbarKey = new PluginKey('table-toolbar');

export const createTableToolbarPlugin = (updateCb: (show: boolean, left: number, top: number) => void) => {
  return new Plugin({
    key: tableToolbarKey,
    view() {
      return {
        update(view) {
          const { state } = view;
          const { selection } = state;

          // 寻找当前选区是否在 table 节点内
          let tableNodePos = -1;
          const $pos = selection.$from;
          for (let d = $pos.depth; d > 0; d--) {
            if ($pos.node(d).type.name === 'table') {
              tableNodePos = $pos.before(d);
              break;
            }
          }

          if (tableNodePos === -1) {
            updateCb(false, 0, 0);
            return;
          }

          // 获取表格的 DOM 坐标
          const dom = view.nodeDOM(tableNodePos) as HTMLElement;
          if (dom) {
            const rect = dom.getBoundingClientRect();
            // 菜单显示在表格顶部中央
            updateCb(true, rect.left + rect.width / 2, rect.top);
          }
        }
      };
    }
  });
};

export const handleTableAction = (view: EditorView, type: string) => {
  const { state, dispatch } = view;
  let command;

  switch (type) {
    case 'addColumnBefore': command = addColumnBefore; break;
    case 'addColumnAfter': command = addColumnAfter; break;
    case 'deleteColumn': command = deleteColumn; break;
    case 'addRowBefore': command = addRowBefore; break;
    case 'addRowAfter': command = addRowAfter; break;
    case 'deleteRow': command = deleteRow; break;
    case 'deleteTable': command = deleteTable; break;
  }

  if (command && command(state, dispatch)) {
    view.focus();
  }
};
