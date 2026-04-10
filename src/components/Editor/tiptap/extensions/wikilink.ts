/**
 * Wikilink 内联节点扩展
 *
 * 支持 Obsidian 风格 [[page]] 和 [[page|display]] 语法。
 * 渲染为带有特殊样式的内联链接。
 */
import { Node, mergeAttributes, InputRule } from '@tiptap/vue-3';

export const Wikilink = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      target: { default: '' },
      alias: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const target = node.attrs.target as string;
    const alias = node.attrs.alias as string;
    const display = alias || target;

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wikilink': target,
        class: 'mk-wikilink',
        title: target,
      }),
      display,
    ];
  },

  addInputRules() {
    return [
      // [[page|alias]] 或 [[page]]
      new InputRule({
        find: /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/,
        handler: ({ state, range, match }) => {
          const target = match[1]?.trim() || '';
          const alias = match[2]?.trim() || '';
          if (!target) return;

          const node = this.type.create({ target, alias });
          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});
