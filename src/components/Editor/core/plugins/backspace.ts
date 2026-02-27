import type { EditorState, Transaction } from 'prosemirror-state';

import { mySchema } from '../schema';

// 退格键处理：将标题/引用/列表项转换为普通段落
export const backspaceCommand = (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
  const { selection, tr } = state;

  // 如果有选中内容，使用默认删除行为
  if (!selection.empty) {
    return false;
  }

  const $from = selection.$from;

  // 遍历深度，找到 list_item
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'list_item' || node.type.name === 'task_item') {
      // 检查光标是否在这个列表项的真正开头
      const offsetInParent = $from.index(d - 1);
      if (offsetInParent === 0 && $from.parentOffset === 0) {
        // 找到列表容器 (bullet_list 或 ordered_list 或 task_list)
        const listContainer = $from.node(d - 1);
        if (listContainer && (listContainer.type.name === 'bullet_list' ||
            listContainer.type.name === 'ordered_list' ||
            listContainer.type.name === 'task_list')) {

          // 提取列表项的内容
          const listItemNode = $from.node(d);

          // 列表项的内容可能是段落或其他
          let paragraphContent = listItemNode.content;

          // 如果内容是单个段落，提取段落内容
          if (paragraphContent.childCount === 1 && paragraphContent.firstChild?.type.name === 'paragraph') {
            paragraphContent = paragraphContent.firstChild.content;
          }

          const paragraph = mySchema.nodes.paragraph.create(null, paragraphContent);

          // 替换整个列表项为段落
          const listItemPos = $from.before(d);
          tr.replaceWith(listItemPos, listItemPos + listItemNode.nodeSize, paragraph);

          if (dispatch) {
            dispatch(tr);
          }
          return true;
        }
      }
      // 光标在列表项中但不是开头，使用默认行为
      return false;
    }
  }

  // 处理标题和引用
  if ($from.parentOffset === 0) {
    const node = $from.parent;
    if (node.type.name === 'heading' || node.type.name === 'blockquote') {
      if (dispatch) {
        dispatch(tr.setBlockType(selection.from, selection.to, mySchema.nodes.paragraph));
      }
      return true;
    }
  }

  return false;
};
