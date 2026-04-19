/**
 * Link Token 实体化（方案 C Phase D）
 *
 * 将链接语法符号 [ ] (url) 从 Decoration widget 升格为真实 PM 节点。
 * Link mark 仍作为真理源，token 节点由 plugin 派生维护。
 *
 * 文档结构：[linkBracketOpen] <link>text</link> [linkBracketClose] [linkUrl{href}]
 */
import { Node, Extension } from '@tiptap/vue-3';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode, NodeType, MarkType } from '@tiptap/pm/model';
import { TOKEN_NODE_NAMES } from './mark-tokens';

const linkTokenSyncKey = new PluginKey('linkTokenSync');

// ── Token 节点定义 ──────────────────────────────────────────

export const LinkBracketOpen = Node.create({
  name: 'linkBracketOpen',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'span[data-mark-token="linkBracketOpen"]' }];
  },

  renderHTML() {
    return [
      'span',
      {
        'data-mark-token': 'linkBracketOpen',
        class: 'mk-tok mk-tok-link-bracket',
        contenteditable: 'false',
      },
      '[',
    ];
  },
});

export const LinkBracketClose = Node.create({
  name: 'linkBracketClose',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'span[data-mark-token="linkBracketClose"]' }];
  },

  renderHTML() {
    return [
      'span',
      {
        'data-mark-token': 'linkBracketClose',
        class: 'mk-tok mk-tok-link-bracket',
        contenteditable: 'false',
      },
      ']',
    ];
  },
});

export const LinkUrl = Node.create({
  name: 'linkUrl',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: '' },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mark-token="linkUrl"]' }];
  },

  renderHTML({ node }) {
    const title = node.attrs.title;
    const text = title ? `(${node.attrs.href} "${title}")` : `(${node.attrs.href})`;
    return [
      'span',
      {
        'data-mark-token': 'linkUrl',
        class: 'mk-tok mk-tok-link-url',
        contenteditable: 'false',
      },
      text,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span');
      dom.className = 'mk-tok mk-tok-link-url';
      dom.setAttribute('data-mark-token', 'linkUrl');
      dom.contentEditable = 'false';

      let editing = false;
      let currentHref = node.attrs.href as string;
      let currentTitle = node.attrs.title as string | null;

      function renderDisplay() {
        dom.textContent = currentTitle
          ? `(${currentHref} "${currentTitle}")`
          : `(${currentHref})`;
        dom.classList.remove('mk-tok-link-url--editing');
      }

      function startEdit() {
        if (editing) return;
        editing = true;
        dom.classList.add('mk-tok-link-url--editing');
        dom.innerHTML = '';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentHref;
        input.className = 'mk-link-url-input';
        input.placeholder = 'URL...';
        dom.appendChild(input);

        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });

        function commit() {
          if (!editing) return;
          editing = false;
          const newHref = input.value.trim();
          if (newHref && newHref !== currentHref) {
            const pos = typeof getPos === 'function' ? getPos() : null;
            if (pos != null) {
              const { tr } = editor.state;
              tr.setNodeMarkup(pos, undefined, { href: newHref, title: currentTitle });

              // 同步更新 link mark 的 href
              const linkMarkType = editor.state.schema.marks.link as MarkType | undefined;
              if (linkMarkType) {
                syncLinkMarkHref(tr, pos, linkMarkType, newHref, currentTitle);
              }

              editor.view.dispatch(tr);
              currentHref = newHref;
            }
          }
          renderDisplay();
        }

        function cancel() {
          if (!editing) return;
          editing = false;
          renderDisplay();
        }

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        });

        input.addEventListener('blur', () => {
          requestAnimationFrame(() => {
            if (editing) commit();
          });
        });
      }

      dom.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startEdit();
      });

      renderDisplay();

      return {
        dom,
        update(updatedNode: PMNode) {
          if (updatedNode.type.name !== 'linkUrl') return false;
          currentHref = updatedNode.attrs.href as string;
          currentTitle = updatedNode.attrs.title as string | null;
          if (!editing) renderDisplay();
          return true;
        },
        stopEvent(event: Event) {
          if (editing) return true;
          if (event.type === 'mousedown' || event.type === 'click') return true;
          return false;
        },
        ignoreMutation() {
          return true;
        },
        destroy() {
          editing = false;
        },
      };
    };
  },
});

/**
 * 在 linkUrl 节点位置附近找到 link mark run，更新其 href
 */
function syncLinkMarkHref(
  tr: any,
  linkUrlPos: number,
  linkMarkType: MarkType,
  newHref: string,
  title: string | null,
) {
  const doc = tr.doc;
  const $pos = doc.resolve(linkUrlPos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return;

  const parentStart = $pos.start($pos.depth);

  // 向左扫描找到 link mark 文本范围
  let linkFrom = -1;
  let linkTo = -1;

  parent.forEach((child: PMNode, offset: number) => {
    if (child.isText && child.marks.some((m: any) => m.type.name === 'link')) {
      const absPos = parentStart + offset;
      if (linkFrom === -1) linkFrom = absPos;
      linkTo = absPos + child.nodeSize;
    }
  });

  if (linkFrom === -1) return;

  // 找到最近的 link mark run（在 linkUrl 之前的那段）
  // 重新扫描更精确：找到紧邻 linkUrl 左侧的连续 link mark 文本
  linkFrom = -1;
  linkTo = -1;
  const linkUrlOffset = linkUrlPos - parentStart;

  parent.forEach((child: PMNode, offset: number) => {
    if (offset >= linkUrlOffset) return;
    if (child.isText && child.marks.some((m: any) => m.type.name === 'link')) {
      const absPos = parentStart + offset;
      if (linkFrom === -1) linkFrom = absPos;
      linkTo = absPos + child.nodeSize;
    } else if (!LINK_TOKEN_NAMES.has(child.type.name) && !TOKEN_NODE_NAMES.has(child.type.name)) {
      linkFrom = -1;
      linkTo = -1;
    }
  });

  if (linkFrom === -1 || linkTo === -1) return;

  const oldMark = linkMarkType.create({ href: newHref, title });
  // 先移除旧的 link mark，再添加新的
  const mappedFrom = tr.mapping.map(linkFrom);
  const mappedTo = tr.mapping.map(linkTo);

  // 找到旧 mark
  tr.doc.nodesBetween(mappedFrom, mappedTo, (node: PMNode) => {
    if (node.isText) {
      const existingLink = node.marks.find((m: any) => m.type.name === 'link');
      if (existingLink) {
        tr.removeMark(mappedFrom, mappedTo, linkMarkType);
        tr.addMark(mappedFrom, mappedTo, oldMark);
        return false;
      }
    }
  });
}

// ── Link Token 名称集合 ────────────────────────────────────

const LINK_TOKEN_NAMES = new Set(['linkBracketOpen', 'linkBracketClose', 'linkUrl']);

// 注册到全局 TOKEN_NODE_NAMES
LINK_TOKEN_NAMES.forEach((name) => TOKEN_NODE_NAMES.add(name));

// ── 搜索辅助函数 ──────────────────────────────────────────

function searchTokenBefore(
  doc: PMNode, pos: number, tokenName: string, lowerBound: number,
): boolean {
  let p = pos - 1;
  while (p >= lowerBound) {
    try {
      const node = doc.nodeAt(p);
      if (!node) break;
      if (node.type.name === tokenName) return true;
      if (TOKEN_NODE_NAMES.has(node.type.name)) { p--; continue; }
      break;
    } catch { break; }
  }
  return false;
}

function searchTokenAfter(
  doc: PMNode, pos: number, tokenName: string, upperBound: number,
): { pos: number } | null {
  let p = pos;
  while (p < upperBound) {
    try {
      const node = doc.nodeAt(p);
      if (!node) break;
      if (node.type.name === tokenName) return { pos: p };
      if (TOKEN_NODE_NAMES.has(node.type.name)) { p += node.nodeSize; continue; }
      break;
    } catch { break; }
  }
  return null;
}

function hasLinkTextNearby(
  doc: PMNode, pos: number, direction: 'before' | 'after', bound: number,
): boolean {
  let p = direction === 'before' ? pos - 1 : pos;
  while (direction === 'before' ? p >= bound : p < bound) {
    if (p < 0 || p >= doc.content.size) break;
    try {
      const node = doc.nodeAt(p);
      if (!node) break;
      if (node.isText && node.marks.some((m) => m.type.name === 'link')) return true;
      if (TOKEN_NODE_NAMES.has(node.type.name)) {
        p += direction === 'before' ? -1 : node.nodeSize;
        continue;
      }
      break;
    } catch { break; }
  }
  return false;
}

// ── Link Token 同步 Plugin ─────────────────────────────────

interface LinkRun {
  from: number;
  to: number;
  href: string;
  title: string | null;
}

function collectLinkRuns(block: PMNode, blockStart: number): LinkRun[] {
  const runs: LinkRun[] = [];
  let runFrom = -1;
  let runTo = -1;
  let runHref = '';
  let runTitle: string | null = null;

  block.forEach((child, offset) => {
    // token 节点透明：不切断 link run
    if (TOKEN_NODE_NAMES.has(child.type.name)) return;

    const absPos = blockStart + offset;
    const linkMark = child.isText
      ? child.marks.find((m) => m.type.name === 'link')
      : null;

    if (linkMark) {
      if (runFrom === -1) {
        runFrom = absPos;
        runHref = linkMark.attrs.href ?? '';
        runTitle = linkMark.attrs.title ?? null;
      }
      runTo = absPos + child.nodeSize;
    } else {
      if (runFrom !== -1) {
        runs.push({ from: runFrom, to: runTo, href: runHref, title: runTitle });
        runFrom = -1;
      }
    }
  });

  if (runFrom !== -1) {
    runs.push({ from: runFrom, to: runTo, href: runHref, title: runTitle });
  }

  return runs;
}

type LinkAction =
  | { kind: 'insert'; pos: number; tokenName: string; attrs?: Record<string, any> }
  | { kind: 'delete'; from: number; to: number }
  | { kind: 'updateAttrs'; pos: number; attrs: Record<string, any> };

function buildLinkTokenSyncPlugin(): Plugin {
  return new Plugin({
    key: linkTokenSyncKey,

    appendTransaction(_trs, _oldState, newState) {
      const actions: LinkAction[] = [];
      const linkBracketOpenType = newState.schema.nodes.linkBracketOpen as NodeType | undefined;
      const linkBracketCloseType = newState.schema.nodes.linkBracketClose as NodeType | undefined;
      const linkUrlType = newState.schema.nodes.linkUrl as NodeType | undefined;

      if (!linkBracketOpenType || !linkBracketCloseType || !linkUrlType) return null;

      newState.doc.descendants((node, pos) => {
        if (!node.isTextblock) return;

        const blockStart = pos + 1;
        const runs = collectLinkRuns(node, blockStart);

        for (const run of runs) {
          // 检查 linkBracketOpen：在 run.from 之前搜索（跳过其他 token）
          if (!searchTokenBefore(newState.doc, run.from, 'linkBracketOpen', blockStart)) {
            actions.push({ kind: 'insert', pos: run.from, tokenName: 'linkBracketOpen' });
          }

          // 检查 linkBracketClose：在 run.to 之后搜索
          if (!searchTokenAfter(newState.doc, run.to, 'linkBracketClose', blockStart + node.content.size)) {
            actions.push({ kind: 'insert', pos: run.to, tokenName: 'linkBracketClose' });
          }

          // 检查 linkUrl：在 linkBracketClose 之后搜索
          const urlFound = searchTokenAfter(newState.doc, run.to, 'linkUrl', blockStart + node.content.size);
          if (urlFound) {
            const nodeAtUrl = newState.doc.nodeAt(urlFound.pos);
            if (nodeAtUrl && (nodeAtUrl.attrs.href !== run.href || nodeAtUrl.attrs.title !== run.title)) {
              actions.push({ kind: 'updateAttrs', pos: urlFound.pos, attrs: { href: run.href, title: run.title } });
            }
          } else {
            actions.push({ kind: 'insert', pos: run.to, tokenName: 'linkUrl', attrs: { href: run.href, title: run.title } });
          }
        }

        // 检查孤儿 link token：搜索附近是否有 link mark 文本（跳过其他 token）
        node.forEach((child, childOffset) => {
          if (!LINK_TOKEN_NAMES.has(child.type.name)) return;
          const absPos = blockStart + childOffset;

          if (child.type.name === 'linkBracketOpen') {
            if (!hasLinkTextNearby(newState.doc, absPos + child.nodeSize, 'after', blockStart + node.content.size)) {
              actions.push({ kind: 'delete', from: absPos, to: absPos + 1 });
            }
          } else if (child.type.name === 'linkBracketClose') {
            if (!hasLinkTextNearby(newState.doc, absPos, 'before', blockStart)) {
              actions.push({ kind: 'delete', from: absPos, to: absPos + 1 });
            }
          } else if (child.type.name === 'linkUrl') {
            // 左侧应有 linkBracketClose（可能隔着其他 token）
            if (!searchTokenBefore(newState.doc, absPos, 'linkBracketClose', blockStart)) {
              actions.push({ kind: 'delete', from: absPos, to: absPos + child.nodeSize });
            }
          }
        });

        return false;
      });

      if (actions.length === 0) return null;

      const tr = newState.tr;

      // 去重
      const seen = new Set<string>();
      const deduped = actions.filter((a) => {
        const key = a.kind === 'insert' ? `i:${a.pos}:${a.tokenName}`
          : a.kind === 'delete' ? `d:${a.from}`
          : `u:${a.pos}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // 按位置降序处理
      deduped.sort((a, b) => {
        const posA = a.kind === 'delete' ? a.from : a.pos;
        const posB = b.kind === 'delete' ? b.from : b.pos;
        return posB - posA;
      });

      for (const action of deduped) {
        if (action.kind === 'insert') {
          const type = action.tokenName === 'linkBracketOpen' ? linkBracketOpenType
            : action.tokenName === 'linkBracketClose' ? linkBracketCloseType
            : linkUrlType;
          tr.insert(action.pos, type.create(action.attrs));
        } else if (action.kind === 'delete') {
          tr.delete(action.from, action.to);
        } else if (action.kind === 'updateAttrs') {
          tr.setNodeMarkup(action.pos, undefined, action.attrs);
        }
      }

      return tr;
    },
  });
}

// ── TipTap 扩展入口 ────────────────────────────────────────

export const LinkTokenSync = Extension.create({
  name: 'linkTokenSync',

  addProseMirrorPlugins() {
    return [buildLinkTokenSyncPlugin()];
  },
});
