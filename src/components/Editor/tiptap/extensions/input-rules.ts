/**
 * Markdown InputRules 扩展
 *
 * 在用户输入 Markdown 语法时自动转换为对应的块级元素。
 * 例如：输入 "# " 后自动转为 H1 标题。
 *
 * 注意：TipTap StarterKit 已经内置了大部分 InputRules。
 * 这里补充 StarterKit 未覆盖的规则。
 */
import { Extension } from '@tiptap/vue-3';
import { InputRule } from '@tiptap/vue-3';

/**
 * 输入 $$ 并换行时，创建数学公式块
 */
function mathBlockInputRule() {
  return new InputRule({
    find: /^\$\$\s$/,
    handler: ({ state, range }) => {
      const mathBlockType = state.schema.nodes.mathBlock;
      if (!mathBlockType) return;
      const tr = state.tr.delete(range.from, range.to);
      tr.replaceSelectionWith(mathBlockType.create());
      return;
    },
  });
}

/**
 * 输入 ```mermaid 并换行时，创建 Mermaid 块
 */
function mermaidInputRule() {
  return new InputRule({
    find: /^```mermaid\s$/,
    handler: ({ state, range }) => {
      const mermaidBlockType = state.schema.nodes.mermaidBlock;
      if (!mermaidBlockType) return;
      const tr = state.tr.delete(range.from, range.to);
      tr.replaceSelectionWith(mermaidBlockType.create());
      return;
    },
  });
}

/**
 * 输入 --- 在文档开头时，创建水平线（不是 frontmatter）
 */

export const MarkdownInputRules = Extension.create({
  name: 'markdownInputRules',

  addInputRules() {
    return [
      mathBlockInputRule(),
      mermaidInputRule(),
    ];
  },
});
