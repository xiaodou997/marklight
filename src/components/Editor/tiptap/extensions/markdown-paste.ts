/**
 * Markdown 表格粘贴识别
 *
 * 编辑器的「插入表格」已由 /table 斜杠命令覆盖；但从别的 Markdown 工具/源码里
 * 拷一段 GFM 表格文本粘进来时，默认只会变成纯文本。这个扩展挂一个 handlePaste：
 * 当剪贴板**纯文本**是 GFM 表格时，用统一的 parseMarkdown 把它转成真正的表格节点
 * 插入；其余内容一律放行默认粘贴，避免误伤普通文本。
 *
 * 与逐字符即时转表格（业界 WYSIWYG 普遍不做、体验差）不同，这里只在「粘贴」时机
 * 识别，是 Typora/Obsidian/Notion 的主流做法，且复用现成 parser，成本低、风险小。
 */
import { Extension } from '@tiptap/vue-3';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Slice } from '@tiptap/pm/model';
import type { Schema } from '@tiptap/pm/model';

import { parseMarkdown } from '../markdown/parser';

/**
 * 粗判一段文本是否为 GFM 表格：第一行是表头（含 `|`），第二行是分隔行
 * （每个单元格形如 `---` / `:--` / `--:` / `:-:`）。普通文本几乎不会出现这种
 * 第二行模式，足以作为「是否尝试转换」的门槛；真正的解析交给 parseMarkdown。
 */
export function looksLikeMarkdownTable(text: string): boolean {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return false;

  // 表头行必须含管道符。
  if (!lines[0].includes('|')) return false;

  // 分隔行：去掉首尾可选 `|` 后，每个单元格只由 `-`/`:`/空白组成且至少一个 `-`。
  const sepCells = lines[1]
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|');
  if (sepCells.length === 0) return false;
  return sepCells.every((cell) => /^\s*:?-+:?\s*$/.test(cell));
}

/**
 * 若 text 是 Markdown 表格，解析成可插入当前选区的 Slice；否则返回 null。
 * 额外校验解析结果确实含 table 节点，避免把非表格内容误转成节点。
 */
export function parseMarkdownTablePaste(schema: Schema, text: string): Slice | null {
  if (!schema.nodes.table) return null;
  if (!looksLikeMarkdownTable(text)) return null;

  let doc;
  try {
    doc = parseMarkdown(schema, text);
  } catch {
    return null;
  }
  if (!doc || doc.childCount === 0) return null;

  let hasTable = false;
  doc.descendants((node) => {
    if (node.type.name === 'table') hasTable = true;
    return !hasTable;
  });
  if (!hasTable) return null;

  return new Slice(doc.content, 0, 0);
}

const markdownPastePluginKey = new PluginKey('markdownPaste');

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: markdownPastePluginKey,
        props: {
          handlePaste(view, event) {
            const clipboard = event.clipboardData;
            if (!clipboard) return false;

            const text = clipboard.getData('text/plain');
            if (!text || !looksLikeMarkdownTable(text)) return false;

            // 剪贴板带有富文本 `<table>`（从网页/Excel 拷）时，交给默认 HTML 粘贴，
            // 避免双重转换或丢失来源格式。
            const html = clipboard.getData('text/html');
            if (html && /<table[\s>]/i.test(html)) return false;

            const slice = parseMarkdownTablePaste(view.state.schema, text);
            if (!slice) return false;

            const tr = view.state.tr.replaceSelection(slice).scrollIntoView();
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
