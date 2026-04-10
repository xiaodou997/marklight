/**
 * 代码块扩展 — 基于 CodeBlockLowlight
 *
 * 特性：
 * - 语法高亮（lowlight + highlight.js）
 * - 直接在渲染态编辑代码
 * - 支持语言标识
 */
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

export const CustomCodeBlock = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: null,
  HTMLAttributes: {
    class: 'mk-code-block',
  },
});
