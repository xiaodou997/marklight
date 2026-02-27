import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';
import { Node as ProsemirrorNode, Schema } from 'prosemirror-model';
import markdownit from 'markdown-it';
import texmath from 'markdown-it-texmath';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import markdownItMark from 'markdown-it-mark';
import markdownItDeflist from 'markdown-it-deflist';
import markdownItAbbr from 'markdown-it-abbr';

import { buildTokenSpecs } from './config/token-specs';

/**
 * 核心：使用 markdown-it 并启用所有扩展
 */
const md = markdownit({
  html: false,
  linkify: true,
  typographer: true,
})
  .enable('table')
  .enable('strikethrough')
  .use(texmath, { engine: { render: (tex: string) => tex }, delimiters: 'dollars' })
  .use(markdownItFootnote)
  .use(markdownItSub)
  .use(markdownItSup)
  .use(markdownItMark)
  .use(markdownItDeflist)
  .use(markdownItAbbr);
  // 注意：不使用 markdown-it-task-lists，因为它会将 [ ] 转换为 HTML 标签
  // 生成 html_inline token，导致 ProseMirror 解析错误
  // 任务列表由 postProcessTaskItems 函数处理

/**
 * 后处理：将带有 task 标记的内容转换为真正的任务项节点
 * 现在的 markdown-it-task-lists 会生成特定的 HTML 结构，
 * 但我们在 Prosemirror 中更希望它作为节点处理。
 */
function postProcessTaskItems(doc: ProsemirrorNode, schema: Schema): ProsemirrorNode {
  // 遍历文档，找到包含任务标记的列表项
  const docJson = doc.toJSON() as any;

  function transformContent(content: any[]): any[] {
    if (!content) return [];
    return content.map(node => {
      if (node.type === 'list_item') {
        // 尝试检测任务列表模式
        // markdown-it-task-lists 产生的 token 可能在这里被解析为带有特定文本前缀的 paragraph
        let isTask = false;
        let checked = false;

        if (node.content && node.content.length > 0) {
          const firstChild = node.content[0];
          if (firstChild.type === 'paragraph' && firstChild.content && firstChild.content.length > 0) {
            const firstText = firstChild.content[0];
            if (firstText.text && /^\[([ xX])\]\s/.test(firstText.text)) {
              isTask = true;
              checked = firstText.text.toLowerCase().startsWith('[x]');
              firstText.text = firstText.text.replace(/^\[([ xX])\]\s/, '');
            }
          }
        }

        if (isTask) {
          // 解包 paragraph
          let inlineContent = node.content;
          if (node.content && node.content.length === 1 && node.content[0].type === 'paragraph') {
            inlineContent = node.content[0].content || [];
          }
          return {
            type: 'task_item',
            attrs: { checked },
            content: inlineContent
          };
        }
      }

      if (node.content) {
        node.content = transformContent(node.content);
      }

      return node;
    });
  }

  function transformLists(content: any[]): any[] {
    if (!content) return [];
    return content.map(node => {
      if (node.type === 'bullet_list' || node.type === 'ordered_list') {
        let allTaskItems = true;
        if (node.content && node.content.length > 0) {
          for (const child of node.content) {
            if (child.type !== 'task_item') {
              allTaskItems = false;
              break;
            }
          }
        } else {
          allTaskItems = false;
        }

        if (allTaskItems) {
          node.type = 'task_list';
        }
      }

      if (node.content) {
        node.content = transformLists(node.content);
      }

      return node;
    });
  }

  if (docJson.content) {
    docJson.content = transformContent(docJson.content);
    docJson.content = transformLists(docJson.content);
  }

  try {
    return ProsemirrorNode.fromJSON(schema, docJson);
  } catch (e) {
    console.error('Failed to transform task items:', e);
    return doc;
  }
}

// 缩写定义存储
let currentAbbrDefinitions: Record<string, string> = {};

function extractAbbrDefinitions(content: string): Record<string, string> {
  const defs: Record<string, string> = {};
  const re = /^\*\[([^\]]+)\]:\s*(.+)$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    defs[match[1]] = match[2];
  }
  return defs;
}

/**
 * 自定义 Markdown 解析器
 */
export function parseMarkdown(content: string, schema: Schema): ProsemirrorNode {
  currentAbbrDefinitions = extractAbbrDefinitions(content);

  const tokenSpecs = buildTokenSpecs(schema);
  const parser = new MarkdownParser(schema, md, tokenSpecs);
  (parser as any).tokenHandlers.footnote_anchor = () => {};

  try {
    const doc = parser.parse(content);
    return postProcessTaskItems(doc, schema);
  } catch (e) {
    console.error('Markdown parse error:', e);
    return schema.node('doc', null, [schema.node('paragraph')]);
  }
}

/**
 * 序列化：ProseMirror Node -> Markdown
 */
export function serializeMarkdown(doc: ProsemirrorNode): string {
  const serializer = new MarkdownSerializer(
    {
      ...defaultMarkdownSerializer.nodes,
      table(state, node) {
        let rowIndex = 0;
        node.forEach((row: any) => {
          if (row.type.name === 'table_row') {
            row.forEach((cell: any, _: any, offset: number) => {
              state.write(offset > 0 ? ' | ' : '| ');
              state.renderInline(cell);
            });
            state.write(' |\n');
            if (rowIndex === 0) {
              let cellCount = 0;
              row.forEach(() => cellCount++);
              for (let i = 0; i < cellCount; i++) {
                state.write(i === 0 ? '| --- ' : '| --- ');
              }
              state.write('|\n');
            }
            rowIndex++;
          }
        });
        state.ensureNewLine();
      },
      task_list(state, node) {
        node.forEach((child: any, _: any, i: number) => {
          if (i && (state as any).closed) (state as any).flushClose(3);
          const checked = child.attrs.checked ? '[x]' : '[ ]';
          state.write(`- ${checked} `);
          state.renderInline(child);
          state.ensureNewLine();
        });
        state.closeBlock(node);
      },
      task_item(state, node) {
        state.renderInline(node);
      },
      math_inline(state, node) {
        state.write('$' + (node.attrs.latex || node.textContent) + '$');
      },
      math_block(state, node) {
        state.write('$$\n' + (node.attrs.latex || node.textContent) + '\n$$');
        state.closeBlock(node);
      },
      footnote_ref(state, node) {
        state.write(`[^${node.attrs.label || node.attrs.id}]`);
      },
      footnote_block(state, node) {
        state.write('\n');
        node.forEach((item: any) => {
          const label = item.attrs.label || item.attrs.id;
          state.write(`[^${label}]: `);
          item.forEach((child: any, _: any, i: number) => {
            if (i > 0) state.write('    ');
            state.renderContent(child);
          });
        });
      },
      footnote_item(state, node) {
        state.renderContent(node);
      },
      definition_list(state, node) {
        node.forEach((child: any) => {
          if (child.type.name === 'definition_term') {
            state.renderInline(child);
            state.ensureNewLine();
          } else if (child.type.name === 'definition_description') {
            child.forEach((block: any) => {
              state.write(':   ');
              state.renderContent(block);
            });
          }
        });
        state.closeBlock(node);
      },
      definition_term(state, node) {
        state.renderInline(node);
        state.ensureNewLine();
      },
      definition_description(state, node) {
        state.write(':   ');
        state.renderContent(node);
      }
    },
    {
      ...defaultMarkdownSerializer.marks,
      strikethrough: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
      highlight: { open: "==", close: "==", mixable: true, expelEnclosingWhitespace: true },
      subscript: { open: "~", close: "~", mixable: false, expelEnclosingWhitespace: true },
      superscript: { open: "^", close: "^", mixable: false, expelEnclosingWhitespace: true },
      abbreviation: { open: "", close: "", mixable: false }
    }
  );

  let result = serializer.serialize(doc);

  if (Object.keys(currentAbbrDefinitions).length > 0) {
    const abbrLines = Object.entries(currentAbbrDefinitions)
      .map(([abbr, full]) => `*[${abbr}]: ${full}`)
      .join('\n');
    result = result.trimEnd() + '\n\n' + abbrLines + '\n';
  }

  return result;
}

export { md };
