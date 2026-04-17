/**
 * InlineDecoPlugin — Typora 风格的内联源码提示
 *
 * 当光标位于带有 mark 的文本中时，在 mark 的边界处插入对应的 Markdown 语法标记装饰。
 * 例如：光标在 **bold** 文本内时，在两端显示 ** 符号。
 *
 * 核心原则：
 * - 不做任何节点转换，只添加/移除装饰 widget
 * - 节点结构始终保持不变
 * - 只在光标所在位置的 marks 上显示标记
 */
import { Extension } from '@tiptap/vue-3';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';

const inlineDecoKey = new PluginKey('inlineDeco');

// ── Mark → Markdown 语法标记映射 ──

interface MarkSyntax {
  open: string;
  close: string;
  className: string;
}

// Phase A: bold/italic/strike 已迁移到 mark-tokens.ts，从此表移除
const MARK_SYNTAX: Record<string, MarkSyntax> = {
  code: { open: '`', close: '`', className: 'mk-deco-code' },
  highlight: { open: '==', close: '==', className: 'mk-deco-highlight' },
  superscript: { open: '^', close: '^', className: 'mk-deco-sup' },
  subscript: { open: '~', close: '~', className: 'mk-deco-sub' },
};

// ── 装饰 Widget ──

class SyntaxHintWidget {
  text: string;
  className: string;

  constructor(text: string, className: string) {
    this.text = text;
    this.className = className;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = `mk-syntax-hint ${this.className}`;
    span.textContent = this.text;
    return span;
  }

  eq(other: SyntaxHintWidget) {
    return this.text === other.text && this.className === other.className;
  }
}

// ── 链接 URL Widget ──

class LinkHintWidget {
  href: string;

  constructor(href: string) {
    this.href = href;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'mk-syntax-hint mk-deco-link';
    span.textContent = `(${this.href})`;
    return span;
  }

  eq(other: LinkHintWidget) {
    return this.href === other.href;
  }
}

// ── 构建装饰集 ──

function buildDecorations(state: EditorState): DecorationSet {
  const { selection } = state;
  const { $from } = selection;
  const decos: Decoration[] = [];

  // 1. 检查光标所在位置的 marks
  if (selection.empty) {
    const resolvedMarks = $from.marks();

    for (const mark of resolvedMarks) {
      const syntax = MARK_SYNTAX[mark.type.name];
      if (!syntax) continue;

      // 找到这个 mark 在当前文本节点中的范围
      const markRange = findMarkRange($from.pos, mark.type.name, state);
      if (!markRange) continue;

      // 在 mark 范围的开头和结尾插入装饰 widget
      const openWidget = new SyntaxHintWidget(syntax.open, syntax.className);
      const closeWidget = new SyntaxHintWidget(syntax.close, syntax.className);

      decos.push(
        Decoration.widget(markRange.from, () => openWidget.toDOM(), {
          side: -1,
          key: `${mark.type.name}-open-${markRange.from}`,
        }),
        Decoration.widget(markRange.to, () => closeWidget.toDOM(), {
          side: 1,
          key: `${mark.type.name}-close-${markRange.to}`,
        }),
      );

      // 链接：在 mark 结尾后显示 URL
      if (mark.type.name === 'link' && mark.attrs.href) {
        // 链接用 [ ] 包裹文本，后接 (url)
        const linkOpen = new SyntaxHintWidget('[', 'mk-deco-link-bracket');
        const linkClose = new LinkHintWidget(mark.attrs.href);

        decos.push(
          Decoration.widget(markRange.from, () => linkOpen.toDOM(), {
            side: -1,
            key: `link-bracket-open-${markRange.from}`,
          }),
          Decoration.widget(markRange.to, () => linkClose.toDOM(), {
            side: 1,
            key: `link-url-${markRange.to}`,
          }),
        );
      }
    }

    // 检查链接 mark（单独处理，因为 link mark 不在 MARK_SYNTAX 中）
    const linkMark = resolvedMarks.find(m => m.type.name === 'link');
    if (linkMark && !MARK_SYNTAX['link']) {
      const markRange = findMarkRange($from.pos, 'link', state);
      if (markRange && linkMark.attrs.href) {
        const linkOpen = new SyntaxHintWidget('[', 'mk-deco-link-bracket');
        const linkCloseBracket = new SyntaxHintWidget(']', 'mk-deco-link-bracket');
        const linkUrl = new LinkHintWidget(linkMark.attrs.href);

        decos.push(
          Decoration.widget(markRange.from, () => linkOpen.toDOM(), {
            side: -1,
            key: `link-open-${markRange.from}`,
          }),
          Decoration.widget(markRange.to, () => linkCloseBracket.toDOM(), {
            side: 1,
            key: `link-close-bracket-${markRange.to}`,
          }),
          Decoration.widget(markRange.to, () => linkUrl.toDOM(), {
            side: 2,
            key: `link-url-${markRange.to}`,
          }),
        );
      }
    }

    // 标题前缀已升格为 headingMarker 节点（heading-marker.ts），此处不再渲染装饰
  }

  return DecorationSet.create(state.doc, decos);
}

/**
 * 找到指定位置上某个 mark 的连续范围
 */
function findMarkRange(
  pos: number,
  markName: string,
  state: EditorState,
): { from: number; to: number } | null {
  const $pos = state.doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return null;

  const parentStart = $pos.start($pos.depth);
  let from = pos;
  let to = pos;

  // 向左扫描
  let offset = $pos.parentOffset;
  while (offset > 0) {
    const nodeAt = parent.nodeAt(offset - 1);
    if (!nodeAt || !nodeAt.isText) break;

    // 检查前一个字符处是否有这个 mark
    const prevMarks = nodeAt.marks;
    if (!prevMarks.some(m => m.type.name === markName)) break;

    // 需要按 text node 粒度回退
    const textNodeStart = offset - nodeAt.nodeSize;
    from = parentStart + Math.max(0, textNodeStart);
    offset = textNodeStart;
    if (offset <= 0) break;
  }

  // 向右扫描
  offset = $pos.parentOffset;
  const parentSize = parent.content.size;
  while (offset < parentSize) {
    const nodeAt = parent.nodeAt(offset);
    if (!nodeAt || !nodeAt.isText) break;

    const nodeMarks = nodeAt.marks;
    if (!nodeMarks.some(m => m.type.name === markName)) break;

    to = parentStart + offset + nodeAt.nodeSize;
    offset += nodeAt.nodeSize;
  }

  if (from === to) return null;
  return { from, to };
}

// ── TipTap 扩展 ──

export const InlineDecoPlugin = Extension.create({
  name: 'inlineDeco',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: inlineDecoKey,
        state: {
          init(_, state) {
            return buildDecorations(state);
          },
          apply(tr, oldDecos, _oldState, newState) {
            if (tr.docChanged || tr.selectionSet) {
              return buildDecorations(newState);
            }
            return oldDecos;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
