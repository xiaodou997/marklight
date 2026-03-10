/**
 * 标题编辑插件
 * 在标题开头输入 # 时降级标题（h1 -> h2）
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { mySchema } from '../schema';

export const headingEditKey = new PluginKey('heading-edit');

export const headingEditPlugin = new Plugin({
  key: headingEditKey,
  props: {
    handleTextInput(view, from, to, text) {
      const { state, dispatch } = view;
      
      // 只处理输入 # 的情况
      if (text !== '#') return false;
      
      const $from = state.doc.resolve(from);
      
      // 检查是否在标题开头
      if ($from.parent.type.name !== 'heading') return false;
      if ($from.parentOffset !== 0) return false;
      
      const currentLevel = $from.parent.attrs.level;
      
      // h6 不能再降级
      if (currentLevel >= 6) return false;
      
      // 降级标题：h1 -> h2, h2 -> h3, etc.
      const tr = state.tr.setBlockType(from, to, mySchema.nodes.heading, { level: currentLevel + 1 });
      dispatch(tr);
      
      return true;
    }
  }
});