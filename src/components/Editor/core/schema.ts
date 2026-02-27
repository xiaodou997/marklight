import { Schema } from 'prosemirror-model';
import { schema as baseSchema } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';

export const mySchema = new Schema({
  nodes: baseSchema.spec.nodes
    .append(tableNodes({ tableGroup: "block", cellContent: "inline*", cellAttributes: {} }))
    .append({
      // 任务列表容器
      task_list: {
        group: "block",
        content: "task_item+",
        parseDOM: [{ tag: "ul.task-list" }],
        toDOM: () => ["ul", { class: "task-list" }, 0]
      },
      // 任务列表项
      task_item: {
        group: "block",
        content: "inline*",
        attrs: { checked: { default: false } },
        parseDOM: [{
          tag: "li.task-item",
          getAttrs: (dom: any) => ({ checked: dom.classList.contains("checked") })
        }],
        toDOM: (node: any) => [
          "li",
          { class: `task-item ${node.attrs.checked ? 'checked' : ''}` },
          [
            "input",
            {
              type: "checkbox",
              class: "task-checkbox",
              checked: node.attrs.checked ? "" : undefined,
              contenteditable: "false"
            }
          ],
          ["span", { class: "task-content" }, 0]
        ],
        defining: true
      },
      math_inline: {
        attrs: { latex: { default: '' } },
        group: "inline",
        inline: true,
        atom: true,
        toDOM: (node: any) => ["span", { class: "math-inline", "data-latex": node.attrs.latex }, node.attrs.latex],
        parseDOM: [{ tag: "span.math-inline", getAttrs: (dom: any) => ({ latex: dom.getAttribute("data-latex") || dom.textContent }) }]
      },
      math_block: {
        attrs: { latex: { default: '' } },
        group: "block",
        atom: true,
        toDOM: (node: any) => ["div", { class: "math-block", "data-latex": node.attrs.latex }, node.attrs.latex],
        parseDOM: [{ tag: "div.math-block", getAttrs: (dom: any) => ({ latex: dom.getAttribute("data-latex") || dom.textContent }) }]
      },
      // 脚注引用（行内 atom）
      footnote_ref: {
        group: "inline",
        inline: true,
        atom: true,
        attrs: { id: { default: 0 }, label: { default: '' } },
        toDOM: (node: any) => ["sup", { class: "footnote-ref" }, ["a", { href: `#fn${node.attrs.id}`, id: `fnref${node.attrs.id}` }, `[${node.attrs.label || node.attrs.id}]`]],
        parseDOM: [{ tag: "sup.footnote-ref" }]
      },
      // 脚注内容块
      footnote_block: {
        group: "block",
        content: "footnote_item+",
        parseDOM: [{ tag: "section.footnotes" }],
        toDOM: () => ["section", { class: "footnotes" }, ["hr", { class: "footnotes-sep" }], ["ol", { class: "footnotes-list" }, 0]]
      },
      footnote_item: {
        content: "block+",
        attrs: { id: { default: 0 }, label: { default: '' } },
        parseDOM: [{ tag: "li.footnote-item" }],
        toDOM: (node: any) => ["li", { class: "footnote-item", id: `fn${node.attrs.id}` }, 0]
      },
      // 定义列表
      definition_list: {
        group: "block",
        content: "(definition_term | definition_description)+",
        parseDOM: [{ tag: "dl" }],
        toDOM: () => ["dl", 0]
      },
      definition_term: {
        content: "inline*",
        parseDOM: [{ tag: "dt" }],
        toDOM: () => ["dt", 0]
      },
      definition_description: {
        content: "block+",
        parseDOM: [{ tag: "dd" }],
        toDOM: () => ["dd", 0]
      }
    }),
  marks: baseSchema.spec.marks.append({
    // 删除线 ~~text~~
    strikethrough: {
      parseDOM: [{ tag: "s" }, { tag: "del" }, { style: "text-decoration=line-through" }],
      toDOM: () => ["s", 0]
    },
    // 高亮 ==text==
    highlight: {
      parseDOM: [{ tag: "mark" }],
      toDOM: () => ["mark", 0]
    },
    // 下标 ~text~
    subscript: {
      parseDOM: [{ tag: "sub" }],
      toDOM: () => ["sub", 0]
    },
    // 上标 ^text^
    superscript: {
      parseDOM: [{ tag: "sup", getAttrs: (dom: any) => dom.classList?.contains('footnote-ref') ? false : null }],
      toDOM: () => ["sup", 0]
    },
    // 缩写
    abbreviation: {
      attrs: { title: { default: '' } },
      parseDOM: [{ tag: "abbr", getAttrs: (dom: any) => ({ title: dom.getAttribute("title") || '' }) }],
      toDOM: (mark: any) => ["abbr", { title: mark.attrs.title, class: "abbreviation" }, 0]
    }
  })
});
