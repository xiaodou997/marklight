/**
 * 自定义快捷键扩展
 *
 * 注册 Markdown 常用的格式化快捷键。
 * TipTap StarterKit 已提供基础快捷键（Cmd+B/I/U 等），这里补充额外的。
 */
import { Extension } from '@tiptap/vue-3';

export const CustomShortcuts = Extension.create({
  name: 'customShortcuts',

  addKeyboardShortcuts() {
    return {
      // 标题快捷键
      'Mod-1': () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      'Mod-2': () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      'Mod-3': () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      'Mod-4': () => this.editor.chain().focus().toggleHeading({ level: 4 }).run(),
      'Mod-5': () => this.editor.chain().focus().toggleHeading({ level: 5 }).run(),
      'Mod-6': () => this.editor.chain().focus().toggleHeading({ level: 6 }).run(),
      'Mod-0': () => this.editor.chain().focus().setParagraph().run(),

      // 列表
      'Mod-Shift-8': () => this.editor.chain().focus().toggleBulletList().run(),
      'Mod-Shift-9': () => this.editor.chain().focus().toggleOrderedList().run(),
      'Mod-Shift-x': () => this.editor.chain().focus().toggleTaskList().run(),

      // 块级
      'Mod-Shift-b': () => this.editor.chain().focus().toggleBlockquote().run(),
      'Mod-Shift-c': () => this.editor.chain().focus().toggleCodeBlock().run(),

      // 高亮
      'Mod-Shift-h': () => this.editor.chain().focus().toggleHighlight().run(),

      // 删除线
      'Mod-Shift-s': () => this.editor.chain().focus().toggleStrike().run(),

      // 水平线
      'Mod-Shift--': () => this.editor.chain().focus().setHorizontalRule().run(),
    };
  },
});
