/**
 * Callout 块扩展（Obsidian 风格）
 *
 * 语法：> [!TYPE] Title
 *       > Content...
 *
 * 支持的类型：note, tip, warning, danger, success, quote
 * 渲染为带颜色的提示框。
 */
import { Node, mergeAttributes } from '@tiptap/vue-3';

const CALLOUT_ICONS: Record<string, string> = {
  note: 'i',
  info: 'i',
  tip: '💡',
  warning: '⚠',
  caution: '⚠',
  danger: '🔴',
  important: '❗',
  success: '✅',
  quote: '❝',
};

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-callout-type') || 'note',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-callout-type': attributes.type,
        }),
      },
      title: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-callout-title') || '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-callout-title': attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.type || 'note';
    const title = node.attrs.title || type.charAt(0).toUpperCase() + type.slice(1);
    const icon = CALLOUT_ICONS[type] || 'i';

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'callout',
        class: `mk-callout mk-callout-${type}`,
      }),
      [
        'div',
        { class: 'mk-callout-title' },
        ['span', { class: 'mk-callout-icon' }, icon],
        ['span', {}, title],
      ],
      ['div', { class: 'mk-callout-body' }, 0],
    ];
  },
});
