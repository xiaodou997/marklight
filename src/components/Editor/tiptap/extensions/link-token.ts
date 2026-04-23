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
import type { ViewMutationRecord } from '@tiptap/pm/view';
import { TOKEN_NODE_NAMES } from './mark-tokens';

const linkTokenSyncKey = new PluginKey('linkTokenSync');

function formatLinkUrlText(href: string, title: string | null): string {
  return title ? `(${href} "${title}")` : `(${href})`;
}

function parseLinkUrlText(text: string): { href: string; title: string | null } | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^\((?<href>.+?)(?:\s+"(?<title>(?:[^"\\]|\\.)*)")?\)$/);
  if (!match?.groups?.href) {
    return null;
  }

  const href = match.groups.href.trim();
  if (!href) {
    return null;
  }

  return {
    href,
    title: match.groups.title == null ? null : match.groups.title.replace(/\\"/g, '"'),
  };
}

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
  selectable: false,

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
    return [
      'span',
      {
        'data-mark-token': 'linkUrl',
        class: 'mk-tok mk-tok-link-url',
        contenteditable: 'false',
      },
      formatLinkUrlText(node.attrs.href as string, node.attrs.title as string | null),
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span');
      dom.className = 'mk-tok mk-tok-link-url';
      dom.setAttribute('data-mark-token', 'linkUrl');
      dom.contentEditable = 'false';
      dom.draggable = false;

      const editorText = document.createElement('span');
      editorText.className = 'mk-link-url-editor';
      editorText.contentEditable = 'false';
      editorText.spellcheck = false;
      editorText.draggable = false;
      dom.appendChild(editorText);

      let editing = false;
      let currentHref = node.attrs.href as string;
      let currentTitle = node.attrs.title as string | null;

      function renderDisplay() {
        editorText.textContent = formatLinkUrlText(currentHref, currentTitle);
      }

      function placeCaretAtEnd() {
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(editorText);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      function placeCaretFromPoint(clientX: number, clientY: number) {
        const selection = window.getSelection();
        if (!selection) return false;

        const caretRange = document.caretRangeFromPoint?.(clientX, clientY);
        if (caretRange) {
          selection.removeAllRanges();
          selection.addRange(caretRange);
          return true;
        }

        const caretPosition = document.caretPositionFromPoint?.(clientX, clientY);
        if (caretPosition) {
          const range = document.createRange();
          range.setStart(caretPosition.offsetNode, caretPosition.offset);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }

        return false;
      }

      function syncEditingState() {
        dom.classList.toggle('mk-tok-link-url--editing', editing);
        editorText.contentEditable = editing ? 'plaintext-only' : 'false';
        editorText.style.pointerEvents = editing ? 'auto' : '';
      }

      function commit() {
        const parsed = parseLinkUrlText(editorText.textContent || '');
        if (!parsed) {
          dom.classList.add('mk-tok-link-url--invalid');
          requestAnimationFrame(() => {
            editorText.focus();
            placeCaretAtEnd();
          });
          return;
        }

        dom.classList.remove('mk-tok-link-url--invalid');
        editing = false;
        syncEditingState();

        if (parsed.href === currentHref && parsed.title === currentTitle) {
          renderDisplay();
          return;
        }

        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos != null) {
          const { tr } = editor.state;
          tr.setNodeMarkup(pos, undefined, { href: parsed.href, title: parsed.title });

          const linkMarkType = editor.state.schema.marks.link as MarkType | undefined;
          if (linkMarkType) {
            syncLinkMarkHref(tr, pos, linkMarkType, parsed.href, parsed.title);
          }

          editor.view.dispatch(tr);
          currentHref = parsed.href;
          currentTitle = parsed.title;
        }

        renderDisplay();
      }

      function cancel() {
        editing = false;
        dom.classList.remove('mk-tok-link-url--invalid');
        syncEditingState();
        renderDisplay();
      }

      function startEditing(caretPoint?: { x: number; y: number }) {
        if (editing) return;
        editing = true;
        dom.classList.remove('mk-tok-link-url--invalid');
        syncEditingState();
        requestAnimationFrame(() => {
          editorText.focus();
          if (!caretPoint || !placeCaretFromPoint(caretPoint.x, caretPoint.y)) {
            placeCaretAtEnd();
          }
        });
      }

      editorText.addEventListener('mousedown', (event) => {
        if (editing) return;
        event.preventDefault();
        event.stopPropagation();
        startEditing({ x: event.clientX, y: event.clientY });
      });

      editorText.addEventListener('focus', () => {
        editing = true;
        dom.classList.remove('mk-tok-link-url--invalid');
        syncEditingState();
      });

      editorText.addEventListener('blur', () => {
        requestAnimationFrame(() => {
          if (editing) commit();
        });
      });

      editorText.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          commit();
          editor.commands.focus();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
          editor.commands.focus();
        }
      });

      renderDisplay();
      syncEditingState();

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
          return event.target instanceof globalThis.Node && editorText.contains(event.target);
        },
        ignoreMutation(mutation: ViewMutationRecord) {
          return mutation.target instanceof globalThis.Node && editorText.contains(mutation.target);
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

  let linkFrom = -1;
  let linkTo = -1;
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

  const nextMark = linkMarkType.create({ href: newHref, title });
  const mappedFrom = tr.mapping.map(linkFrom);
  const mappedTo = tr.mapping.map(linkTo);

  tr.removeMark(mappedFrom, mappedTo, linkMarkType);
  tr.addMark(mappedFrom, mappedTo, nextMark);
}

// ── Link Token 名称集合 ────────────────────────────────────

const LINK_TOKEN_NAMES = new Set(['linkBracketOpen', 'linkBracketClose', 'linkUrl']);

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
          if (!searchTokenBefore(newState.doc, run.from, 'linkBracketOpen', blockStart)) {
            actions.push({ kind: 'insert', pos: run.from, tokenName: 'linkBracketOpen' });
          }

          if (!searchTokenAfter(newState.doc, run.to, 'linkBracketClose', blockStart + node.content.size)) {
            actions.push({ kind: 'insert', pos: run.to, tokenName: 'linkBracketClose' });
          }

          const urlFound = searchTokenAfter(newState.doc, run.to, 'linkUrl', blockStart + node.content.size);
          if (urlFound) {
            const nodeAtUrl = newState.doc.nodeAt(urlFound.pos);
            if (nodeAtUrl && (nodeAtUrl.attrs.href !== run.href || nodeAtUrl.attrs.title !== run.title)) {
              actions.push({ kind: 'updateAttrs', pos: urlFound.pos, attrs: { href: run.href, title: run.title } });
            }
          } else {
            actions.push({ kind: 'insert', pos: run.to + 1, tokenName: 'linkUrl', attrs: { href: run.href, title: run.title } });
          }
        }

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
            if (!searchTokenBefore(newState.doc, absPos, 'linkBracketClose', blockStart)) {
              actions.push({ kind: 'delete', from: absPos, to: absPos + child.nodeSize });
            }
          }
        });

        return false;
      });

      if (actions.length === 0) return null;

      const tr = newState.tr;
      const seen = new Set<string>();
      const deduped = actions.filter((a) => {
        const key = a.kind === 'insert' ? `i:${a.pos}:${a.tokenName}`
          : a.kind === 'delete' ? `d:${a.from}`
          : `u:${a.pos}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

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
