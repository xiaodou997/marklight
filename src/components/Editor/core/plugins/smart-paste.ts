import { Plugin } from 'prosemirror-state';
import { Schema, Slice } from 'prosemirror-model';
import { parseMarkdown } from '../markdown';

/**
 * 智能粘贴插件
 * 拦截粘贴的 Markdown 文本并转换为富文本节点
 */
export const createSmartPastePlugin = (schema: Schema) => {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;

        // 简单启发式判断：如果包含 Markdown 特征字符（如 #, **, [ ], |, ``` 等）
        // 且不是简单的单词
        const isMarkdown = /^[ 	]*([#*>-]|\||```)/m.test(text) || /(\*\*|__|_|\[.*\]\(.*\))/.test(text);

        if (isMarkdown) {
          // 1. 将 Markdown 解析为 doc 节点
          const doc = parseMarkdown(text, schema);
          
          // 2. 将 doc 的内容提取出来作为 Slice 插入
          // Slice 代表文档的一个片段，可以直接应用到当前的选区
          const slice = new Slice(doc.content, 0, 0);
          
          const { state, dispatch } = view;
          const tr = state.tr.replaceSelection(slice);
          dispatch(tr);
          
          return true; // 表示该事件已由插件处理，阻止浏览器默认行为
        }

        return false; // 继续默认粘贴行为
      }
    }
  });
};
