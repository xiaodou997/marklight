/**
 * Markdown → ProseMirror Document 解析器
 *
 * 使用 markdown-it 解析 markdown 文本，转换为 ProseMirror 文档节点。
 * 基于 prosemirror-markdown 的 MarkdownParser 模式，但自定义 token 映射以支持 GFM 扩展。
 */
import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { Mark } from '@tiptap/pm/model';
import type { Schema, Node as PMNode, MarkType, NodeType } from '@tiptap/pm/model';

// markdown-it 插件
import markdownItTaskLists from 'markdown-it-task-lists';
import markdownItMark from 'markdown-it-mark';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import markdownItTexmath from 'markdown-it-texmath';
import katex from 'katex';

// ── markdown-it 实例 ───────────────────────────────────────────

function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt('commonmark', { html: false, linkify: false })
    .enable(['table', 'strikethrough']);

  md.use(markdownItTaskLists, { enabled: true, label: false });
  md.use(markdownItMark);
  md.use(markdownItSub);
  md.use(markdownItSup);
  md.use(markdownItTexmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { throwOnError: false },
  });

  return md;
}

// ── Token → PM 节点映射 ────────────────────────────────────────

interface StackItem {
  type: NodeType;
  attrs: Record<string, unknown>;
  content: PMNode[];
  marks: readonly Mark[];
}

class MarkdownParseState {
  schema: Schema;
  stack: StackItem[];
  marks: readonly Mark[];

  constructor(schema: Schema) {
    this.schema = schema;
    this.stack = [{ type: schema.nodes.doc, attrs: {}, content: [], marks: Mark.none }];
    this.marks = Mark.none;
  }

  get top(): StackItem {
    return this.stack[this.stack.length - 1];
  }

  addText(text: string) {
    if (!text) return;
    const top = this.top;
    const nodes = top.content;
    const last = nodes[nodes.length - 1];
    const textNode = this.schema.text(text, this.marks);
    if (last?.isText && Mark.sameSet(last.marks, textNode.marks)) {
      nodes[nodes.length - 1] = this.schema.text(last.text! + text, this.marks);
    } else {
      nodes.push(textNode);
    }
  }

  openMark(markType: MarkType, attrs?: Record<string, unknown>) {
    this.marks = markType.create(attrs).addToSet(this.marks);
  }

  closeMark(markType: MarkType) {
    this.marks = markType.removeFromSet(this.marks);
  }

  openNode(type: NodeType, attrs: Record<string, unknown> = {}) {
    this.stack.push({ type, attrs, content: [], marks: Mark.none });
  }

  closeNode(): PMNode {
    const item = this.stack.pop()!;
    const node = item.type.createAndFill(item.attrs, item.content, this.marks);
    if (!node) {
      // 兜底：创建空段落
      return this.schema.nodes.paragraph.create();
    }
    this.top.content.push(node);
    return node;
  }

  addNode(type: NodeType, attrs: Record<string, unknown> = {}, content?: PMNode[]) {
    const node = type.createAndFill(attrs, content);
    if (node) this.top.content.push(node);
    return node;
  }

  buildDoc(): PMNode {
    while (this.stack.length > 1) this.closeNode();
    return this.top.type.createAndFill(this.top.attrs, this.top.content) || this.schema.nodes.doc.create();
  }
}

// ── Token 处理器 ────────────────────��───────────────────────────

type TokenHandler = (state: MarkdownParseState, token: Token, tokens: Token[], index: number) => void;

function getTokenHandlers(schema: Schema): Record<string, TokenHandler> {
  const handlers: Record<string, TokenHandler> = {};

  // ── 块级节点 ──

  handlers.paragraph_open = (state) => {
    state.openNode(schema.nodes.paragraph);
  };
  handlers.paragraph_close = (state) => {
    state.closeNode();
  };

  handlers.heading_open = (state, token) => {
    const level = parseInt(token.tag.slice(1));
    state.openNode(schema.nodes.heading, { level });
    // 方案 C：marker 是文档实体，作为 heading 的第一个子节点
    if (schema.nodes.headingMarker) {
      state.addNode(schema.nodes.headingMarker, { level });
    }
  };
  handlers.heading_close = (state) => {
    state.closeNode();
  };

  handlers.blockquote_open = (state) => {
    state.openNode(schema.nodes.blockquote);
  };
  handlers.blockquote_close = (state) => {
    state.closeNode();
  };

  handlers.bullet_list_open = (state) => {
    state.openNode(schema.nodes.bulletList);
  };
  handlers.bullet_list_close = (state) => {
    state.closeNode();
  };

  handlers.ordered_list_open = (state, token) => {
    const start = token.attrGet('start');
    state.openNode(schema.nodes.orderedList, { start: start ? parseInt(start) : 1 });
  };
  handlers.ordered_list_close = (state) => {
    state.closeNode();
  };

  handlers.list_item_open = (state, token) => {
    // 检测是否是任务列表项
    // markdown-it-task-lists 会在 token 的 children 中产生 checkbox
    const isTask = token.attrGet('class')?.includes('task-list-item') ?? false;
    if (isTask) {
      const checked = token.attrGet('class')?.includes('checked') ?? false;
      state.openNode(schema.nodes.taskItem, { checked });
    } else {
      state.openNode(schema.nodes.listItem);
    }
  };
  handlers.list_item_close = (state) => {
    state.closeNode();
  };

  handlers.code_block = (state, token) => {
    state.addNode(schema.nodes.codeBlock, { language: null }, [
      schema.text(token.content.replace(/\n$/, '') || ' '),
    ]);
  };

  handlers.fence = (state, token) => {
    const lang = token.info?.trim()?.toLowerCase() || null;
    const content = token.content.replace(/\n$/, '');

    // Mermaid 图表（仅 mermaid 语法；flow/seq 是 flowchart.js/js-sequence-diagrams 的不兼容语法）
    if (lang === 'mermaid') {
      if (schema.nodes.mermaidBlock) {
        state.addNode(schema.nodes.mermaidBlock, {}, content ? [schema.text(content)] : undefined);
        return;
      }
    }

    state.addNode(schema.nodes.codeBlock, { language: lang }, content ? [schema.text(content)] : undefined);
  };

  handlers.hr = (state) => {
    state.addNode(schema.nodes.horizontalRule);
  };

  // ── 表格 ──

  handlers.table_open = (state) => {
    state.openNode(schema.nodes.table);
  };
  handlers.table_close = (state) => {
    state.closeNode();
  };

  handlers.thead_open = () => { /* skip, rows handled directly */ };
  handlers.thead_close = () => {};
  handlers.tbody_open = () => {};
  handlers.tbody_close = () => {};

  handlers.tr_open = (state) => {
    state.openNode(schema.nodes.tableRow);
  };
  handlers.tr_close = (state) => {
    state.closeNode();
  };

  handlers.th_open = (state) => {
    state.openNode(schema.nodes.tableHeader);
    state.openNode(schema.nodes.paragraph);
  };
  handlers.th_close = (state) => {
    state.closeNode(); // paragraph
    state.closeNode(); // tableHeader
  };

  handlers.td_open = (state) => {
    state.openNode(schema.nodes.tableCell);
    state.openNode(schema.nodes.paragraph);
  };
  handlers.td_close = (state) => {
    state.closeNode(); // paragraph
    state.closeNode(); // tableCell
  };

  // ── 图片 ──

  handlers.image = (state, token) => {
    const src = token.attrGet('src') || '';
    const alt = token.content || token.children?.map(t => t.content).join('') || '';
    const title = token.attrGet('title') || null;
    state.addNode(schema.nodes.image, { src, alt, title });
  };

  if (schema.nodes.mathInline) {
    handlers.math_inline = (state, token) => {
      state.addNode(schema.nodes.mathInline, { latex: token.content.trim() });
    };
  }

  if (schema.nodes.mathBlock) {
    handlers.math_block = (state, token) => {
      const latex = token.content.replace(/^\n|\n$/g, '');
      state.addNode(schema.nodes.mathBlock, {}, latex ? [schema.text(latex)] : undefined);
    };
  }

  // ── 行内标记 ──

  handlers.em_open = (state) => {
    state.openMark(schema.marks.italic);
  };
  handlers.em_close = (state) => {
    state.closeMark(schema.marks.italic);
  };

  handlers.strong_open = (state) => {
    state.openMark(schema.marks.bold);
  };
  handlers.strong_close = (state) => {
    state.closeMark(schema.marks.bold);
  };

  handlers.s_open = (state) => {
    state.openMark(schema.marks.strike);
  };
  handlers.s_close = (state) => {
    state.closeMark(schema.marks.strike);
  };

  handlers.code_inline = (state, token) => {
    state.openMark(schema.marks.code);
    state.addText(token.content);
    state.closeMark(schema.marks.code);
  };

  handlers.link_open = (state, token) => {
    const href = token.attrGet('href') || '';
    const title = token.attrGet('title') || null;
    state.openMark(schema.marks.link, { href, target: null, title });
  };
  handlers.link_close = (state) => {
    state.closeMark(schema.marks.link);
  };

  // highlight (==text==)
  handlers.mark_open = (state) => {
    state.openMark(schema.marks.highlight);
  };
  handlers.mark_close = (state) => {
    state.closeMark(schema.marks.highlight);
  };

  // superscript (^text^)
  if (schema.marks.superscript) {
    handlers.sup_open = (state) => {
      state.openMark(schema.marks.superscript);
    };
    handlers.sup_close = (state) => {
      state.closeMark(schema.marks.superscript);
    };
  }

  // subscript (~text~)
  if (schema.marks.subscript) {
    handlers.sub_open = (state) => {
      state.openMark(schema.marks.subscript);
    };
    handlers.sub_close = (state) => {
      state.closeMark(schema.marks.subscript);
    };
  }

  // ── 文本和硬换行 ──

  handlers.text = (state, token) => {
    // 检查文本中是否包含 wikilink [[target]] 或 [[target|alias]]
    if (schema.nodes.wikilink && /\[\[/.test(token.content)) {
      const regex = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(token.content)) !== null) {
        // 添加 wikilink 前的文本
        if (match.index > lastIndex) {
          state.addText(token.content.slice(lastIndex, match.index));
        }
        // 添加 wikilink 节点
        const target = match[1].trim();
        const alias = match[2]?.trim() || '';
        state.addNode(schema.nodes.wikilink, { target, alias });
        lastIndex = regex.lastIndex;
      }
      // 添加剩余文本
      if (lastIndex < token.content.length) {
        state.addText(token.content.slice(lastIndex));
      }
    } else {
      state.addText(token.content);
    }
  };

  handlers.inline = (state, token) => {
    if (token.children) {
      for (let i = 0; i < token.children.length; i++) {
        const child = token.children[i];
        const handler = handlers[child.type];
        if (handler) {
          handler(state, child, token.children!, i);
        } else if (child.type === 'text') {
          state.addText(child.content);
        }
        // 跳过 checkbox input（markdown-it-task-lists 的产物）
      }
    }
  };

  handlers.softbreak = (state) => {
    state.addText('\n');
  };

  handlers.hardbreak = (state) => {
    state.addNode(schema.nodes.hardBreak);
  };

  // ── HTML 块（忽略） ──
  handlers.html_block = () => {};
  handlers.html_inline = (state, token) => {
    // 跳过 task-lists 插件生成的 <input> 标签
    if (token.content.includes('type="checkbox"')) return;
    state.addText(token.content);
  };

  return handlers;
}

// ── 解析入口 ──────────────────────────��──────────────────────────

const md = createMarkdownIt();

/**
 * 提取 YAML frontmatter（文档开头的 --- ... ---）
 * 返回 { frontmatter, body }
 */
function extractFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (match) {
    return { frontmatter: match[1], body: content.slice(match[0].length) };
  }
  return { frontmatter: null, body: content };
}

/**
 * 提取 > [!TYPE] 形式的 Callout 块，替换为占位符
 */
function extractCallouts(content: string): { processed: string; callouts: Array<{ type: string; title: string; body: string }> } {
  const callouts: Array<{ type: string; title: string; body: string }> = [];
  const processed = content.replace(/^> \[!(\w+)\]\s*(.*)\n((?:>.*\n?)*)/gm, (_match, type, title, bodyRaw) => {
    const body = bodyRaw.replace(/^> ?/gm, '').trim();
    const index = callouts.length;
    callouts.push({ type: type.toLowerCase(), title: title.trim(), body });
    return `\n<!--CALLOUT_BLOCK_${index}-->\n`;
  });
  return { processed, callouts };
}

export function parseMarkdown(schema: Schema, content: string): PMNode {
  if (!content || !content.trim()) {
    return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
  }

  // 1. 提取 frontmatter
  const { frontmatter, body: bodyAfterFm } = extractFrontmatter(content);

  // 2. 提取 callout 块
  const { processed: bodyFinal, callouts } = extractCallouts(bodyAfterFm);

  // 3. 用 markdown-it 解析主体内容
  const tokens = md.parse(bodyFinal, {});
  const state = new MarkdownParseState(schema);
  const handlers = getTokenHandlers(schema);

  // 插入 frontmatter 节点（如果有）
  if (frontmatter && schema.nodes.frontmatter) {
    state.addNode(schema.nodes.frontmatter, {}, [schema.text(frontmatter)]);
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    const calloutMatch = token.content.match(/<!--CALLOUT_BLOCK_(\d+)-->/);
    if ((token.type === 'html_block' || token.type === 'inline') && calloutMatch && schema.nodes.callout) {
      const idx = parseInt(calloutMatch[1]);
      const callout = callouts[idx];
      if (callout) {
        state.openNode(schema.nodes.callout, { type: callout.type, title: callout.title || callout.type });
        if (callout.body) {
          state.openNode(schema.nodes.paragraph);
          state.addText(callout.body);
          state.closeNode();
        } else {
          state.addNode(schema.nodes.paragraph);
        }
        state.closeNode();
        continue;
      }
    }

    const handler = handlers[token.type];
    if (handler) {
      handler(state, token, tokens, i);
    }
  }

  return state.buildDoc();
}
