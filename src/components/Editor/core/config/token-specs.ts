import type { Schema } from 'prosemirror-model';

function listIsTight(tokens: any[], i: number): boolean {
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.type === 'list_item_close') return false;
    if (tok.type === 'bullet_list_close' || tok.type === 'ordered_list_close') return true;
    i++;
  }
  return false;
}

export function buildTokenSpecs(_schema: Schema): Record<string, any> {
  return {
    // === 基础块级元素 ===
    paragraph: { block: "paragraph" },
    heading: {
      block: "heading",
      getAttrs: (tok: any) => ({ level: Number(tok.tag.slice(1)) })
    },
    blockquote: { block: "blockquote" },
    code_block: { block: "code_block", noCloseToken: true },
    fence: {
      block: "code_block",
      getAttrs: (tok: any) => ({ params: tok.info || "" }),
      noCloseToken: true,
    },
    hr: { node: "horizontal_rule" },

    // === 列表 ===
    list_item: { block: "list_item" },
    bullet_list: {
      block: "bullet_list",
      getAttrs: (_tok: any, tokens: any[], i: number) => ({ tight: listIsTight(tokens, i) })
    },
    ordered_list: {
      block: "ordered_list",
      getAttrs: (tok: any, tokens: any[], i: number) => ({
        order: Number(tok.attrGet?.('start') || 1),
        tight: listIsTight(tokens, i),
      }),
    },

    // === 表格 ===
    table: { block: "table" },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: "table_row" },
    th: { block: "table_header" },
    td: { block: "table_cell" },

    // === 行级元素 ===
    image: {
      node: "image",
      getAttrs: (tok: any) => ({
        src: tok.attrGet?.('src') || '',
        title: tok.attrGet?.('title') || null,
        alt: tok.children?.[0]?.content || null,
      }),
    },
    hardbreak: { node: "hard_break" },
    em: { mark: "em" },
    strong: { mark: "strong" },
    link: {
      mark: "link",
      getAttrs: (tok: any) => ({
        href: tok.attrGet?.('src') || tok.attrGet?.('href') || '',
        title: tok.attrGet?.('title') || null,
      }),
    },
    code_inline: { mark: "code", noCloseToken: true },

    // === 扩展行级标记 ===
    s: { mark: "strikethrough" },
    mark: { mark: "highlight" },
    sub: { mark: "subscript" },
    sup: { mark: "superscript" },
    abbr: {
      mark: "abbreviation",
      getAttrs: (tok: any) => ({ title: tok.attrGet?.('title') || '' })
    },

    // === 脚注 ===
    footnote_ref: {
      node: "footnote_ref",
      noCloseToken: true,
      getAttrs: (tok: any) => ({
        id: tok.meta?.id ?? 0,
        label: tok.meta?.label || ''
      })
    },
    footnote_block: { block: "footnote_block" },
    footnote: {
      block: "footnote_item",
      getAttrs: (tok: any) => ({
        id: tok.meta?.id ?? 0,
        label: tok.meta?.label || ''
      })
    },

    // === 定义列表 ===
    dl: { block: "definition_list" },
    dt: { block: "definition_term" },
    dd: { block: "definition_description" },

    // === HTML tokens (由 markdown-it-task-lists 等插件生成) ===
    // 忽略这些 token，因为任务列表状态已通过后处理从文本 [ ]/[x] 提取
    html_inline: { ignore: true },
    html_block: { ignore: true },

    // === 数学公式 ===
    math_inline: {
      node: "math_inline",
      noCloseToken: true,
      getAttrs: (tok: any) => ({ latex: tok.content || '' })
    },
    math_inline_double: {
      node: "math_block",
      noCloseToken: true,
      getAttrs: (tok: any) => ({ latex: tok.content || '' })
    },
    math_block: {
      node: "math_block",
      noCloseToken: true,
      getAttrs: (tok: any) => ({ latex: tok.content || '' })
    },
    math_block_eqno: {
      node: "math_block",
      noCloseToken: true,
      getAttrs: (tok: any) => ({ latex: tok.content || '' })
    },
  };
}
