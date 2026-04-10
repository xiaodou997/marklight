/**
 * 上标 (Superscript) 和下标 (Subscript) Mark 扩展
 *
 * Markdown 语法：
 * - 上标：^text^  → <sup>text</sup>
 * - 下标：~text~  → <sub>text</sub>
 */
import { Mark, markInputRule, markPasteRule } from '@tiptap/vue-3';

export const Superscript = Mark.create({
  name: 'superscript',

  parseHTML() {
    return [{ tag: 'sup' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', HTMLAttributes, 0];
  },

  addInputRules() {
    return [
      markInputRule({
        find: /\^([^^]+)\^$/,
        type: this.type,
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: /\^([^^]+)\^/g,
        type: this.type,
      }),
    ];
  },
});

export const Subscript = Mark.create({
  name: 'subscript',

  parseHTML() {
    return [{ tag: 'sub' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sub', HTMLAttributes, 0];
  },

  addInputRules() {
    return [
      markInputRule({
        find: /~([^~]+)~$/,
        type: this.type,
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: /~([^~]+)~/g,
        type: this.type,
      }),
    ];
  },
});
