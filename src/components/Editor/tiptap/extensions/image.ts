/**
 * 图片扩展
 *
 * 支持本地路径、网络 URL、data URI。
 * Tauri 环境下的 asset:// 协议路径会自动转换。
 */
import Image from '@tiptap/extension-image';

export const CustomImage = Image.configure({
  inline: true,
  allowBase64: true,
  HTMLAttributes: {
    class: 'mk-image',
    loading: 'lazy',
  },
});
