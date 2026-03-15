import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Slice } from 'prosemirror-model';
import { liftListItem } from 'prosemirror-schema-list';

import { markDelimiters, findMarkRange, getMarkBoundaries } from '../utils/marks';
import { delimNavKey, type DelimNav } from './delim-nav';
import { mySchema } from '../schema';

type MarkerKind = 'heading' | 'blockquote' | 'bullet' | 'task';

type SourceRevealState = {
  markerEdit: boolean;
  kind: MarkerKind | null;
  nodePos: number | null;
  textFrom: number | null;
  level: number;
  checked: boolean;
};

let currentView: EditorView | null = null;

function moveSelectionToPrev(pos: number) {
  if (!currentView) return;
  const { state, dispatch } = currentView;
  const sel = TextSelection.near(state.doc.resolve(pos), -1);
  dispatch(state.tr.setSelection(sel));
  currentView.focus();
}

function setBlockTypeForNode(tr: any, nodePos: number, type: any, attrs?: Record<string, any>) {
  const node = tr.doc.nodeAt(nodePos);
  if (!node) return tr;
  const from = nodePos + 1;
  const to = nodePos + node.nodeSize - 1;
  tr.setBlockType(from, to, type, attrs);
  return tr;
}

function liftListItemAt(state: any, itemType: any) {
  let liftedTr: any = null;
  const lifted = liftListItem(itemType)(state, (nextTr: any) => {
    liftedTr = nextTr;
  });
  if (!lifted || !liftedTr) return null;
  return liftedTr;
}

function findMarkerContext(state: any) {
  const { $from } = state.selection;
  if (!$from || $from.parentOffset !== 0) return null;

  if ($from.parent.type.name === 'heading') {
    return {
      kind: 'heading' as MarkerKind,
      nodePos: $from.before($from.depth),
      textFrom: $from.start($from.depth),
      level: $from.parent.attrs.level || 1,
      checked: false
    };
  }

  if ($from.parent.type.name === 'task_item') {
    return {
      kind: 'task' as MarkerKind,
      nodePos: $from.before($from.depth),
      textFrom: $from.start($from.depth),
      level: 0,
      checked: Boolean($from.parent.attrs.checked)
    };
  }

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'list_item') {
      return {
        kind: 'bullet' as MarkerKind,
        nodePos: $from.before(d),
        textFrom: $from.start($from.depth),
        level: 0,
        checked: false
      };
    }
    if (node.type.name === 'blockquote') {
      if ($from.index(d) === 0) {
        return {
          kind: 'blockquote' as MarkerKind,
          nodePos: $from.before(d),
          textFrom: $from.start($from.depth),
          level: 0,
          checked: false
        };
      }
      break;
    }
  }
  return null;
}

function readPrefix(state: any, ctx: { kind: MarkerKind; nodePos: number; textFrom: number }) {
  const from = ctx.textFrom;
  const to = Math.min(from + 16, state.doc.content.size);
  const text = state.doc.textBetween(from, to, '\n', '\n');
  if (ctx.kind === 'heading') {
    const match = text.match(/^(#{1,6})(\s?)/);
    if (!match) return { len: 0, level: 0, checked: false };
    return { len: match[0].length, level: match[1].length, checked: false };
  }
  if (ctx.kind === 'blockquote') {
    const match = text.match(/^(>+)(\s?)/);
    if (!match) return { len: 0, level: 0, checked: false };
    return { len: match[0].length, level: match[1].length, checked: false };
  }
  if (ctx.kind === 'task') {
    const match = text.match(/^[-*+]\s+\[([ xX])\]\s?/);
    if (!match) return { len: 0, level: 0, checked: false };
    return { len: match[0].length, level: 0, checked: match[1].toLowerCase() === 'x' };
  }
  if (ctx.kind === 'bullet') {
    const match = text.match(/^[-*+](\s?)/);
    if (!match) return { len: 0, level: 0, checked: false };
    return { len: match[0].length, level: 0, checked: false };
  }
  return { len: 0, level: 0, checked: false };
}

function unwrapBlockquote(tr: any, pos: number) {
  const node = tr.doc.nodeAt(pos);
  if (!node || node.type.name !== 'blockquote') return tr;
  const slice = new Slice(node.content, 0, 0);
  tr.replaceRange(pos, pos + node.nodeSize, slice);
  return tr;
}

// 高亮当前节点 + 显示定界符的插件
export const sourceRevealPlugin: Plugin<SourceRevealState> = new Plugin<SourceRevealState>({
  key: new PluginKey('source-reveal'),
  view(view) {
    currentView = view;
    return {
      destroy() {
        if (currentView === view) {
          currentView = null;
        }
      }
    };
  },
  state: {
    init() {
      return { markerEdit: false, kind: null, nodePos: null, textFrom: null, level: 0, checked: false };
    },
    apply(tr, prev) {
      const meta = tr.getMeta(sourceRevealPlugin);
      if (meta) {
        return { ...prev, ...meta };
      }
      const mappedNodePos = prev.nodePos !== null ? tr.mapping.map(prev.nodePos) : null;
      const mappedTextFrom = prev.textFrom !== null ? tr.mapping.map(prev.textFrom) : null;
      return { ...prev, nodePos: mappedNodePos, textFrom: mappedTextFrom };
    }
  },
  props: {
    handleKeyDown(view, event) {
      const state = sourceRevealPlugin.getState(view.state);
      if (!state) return false;

      if (state.markerEdit) {
        if (state.nodePos === null || state.textFrom === null || !state.kind) return false;
        const ctx = { kind: state.kind, nodePos: state.nodePos, textFrom: state.textFrom };
        const prefix = readPrefix(view.state, ctx);
        const pos = view.state.selection.from;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          if (pos > state.textFrom) {
            const nextPos = Math.max(state.textFrom, pos - 1);
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, nextPos)));
            return true;
          }
          moveSelectionToPrev(state.nodePos);
          return true;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          const end = state.textFrom + prefix.len;
          if (pos < end) {
            const nextPos = Math.min(end, pos + 1);
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, nextPos)));
            return true;
          }
          const $from = view.state.selection.$from;
          const blockEnd = $from.end();
          const target = Math.min(end + 1, blockEnd);
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target)));
          return true;
        }
        // 其他按键退出编辑态，交给编辑器处理
        return false;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;
      if (!view.state.selection.empty) return false;
      const ctx = findMarkerContext(view.state);
      if (!ctx) return false;
      event.preventDefault();
      const prefix = readPrefix(view.state, ctx);
      let tr = view.state.tr;
      if (prefix.len === 0) {
        let text = '';
        if (ctx.kind === 'heading') {
          text = `${'#'.repeat(ctx.level || 1)} `;
        } else if (ctx.kind === 'blockquote') {
          text = `> `;
        } else if (ctx.kind === 'bullet') {
          text = `- `;
        } else if (ctx.kind === 'task') {
          text = `- [${ctx.checked ? 'x' : ' '}] `;
        }
        tr = tr.insertText(text, ctx.textFrom);
      }
      const newPrefix = readPrefix({ doc: tr.doc } as any, ctx);
      const cursorPos = ctx.textFrom + newPrefix.len;
      tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos));
      tr = tr.setMeta(sourceRevealPlugin, {
        markerEdit: true,
        kind: ctx.kind,
        nodePos: ctx.nodePos,
        textFrom: ctx.textFrom,
        level: ctx.level || newPrefix.level || 0,
        checked: ctx.checked || newPrefix.checked || false
      });
      view.dispatch(tr);
      return true;
    },
    decorations(state) {
      const { selection, doc } = state;
      if (!selection.empty) return DecorationSet.empty;
      const pluginState = sourceRevealPlugin.getState(state);

      const decorations: Decoration[] = [];
      const { $from } = selection;

      // 高亮当前所在块
      if ($from.depth > 0) {
        const node = $from.node($from.depth - 1);
        if (node && (node.type.name === 'heading' || node.type.name === 'blockquote')) {
          const pos = $from.before($from.depth - 1);
          decorations.push(Decoration.node(pos, pos + node.nodeSize, {
            class: `is-active-node active-${node.type.name}`
          }));
        }
      }

      // 标题标记交由真实文本插入处理

      if (pluginState?.markerEdit && pluginState.nodePos !== null) {
        const node = doc.nodeAt(pluginState.nodePos);
        if (node) {
          decorations.push(Decoration.node(pluginState.nodePos, pluginState.nodePos + node.nodeSize, {
            class: 'marker-editing'
          }));
        }
      }

      // === 行内标记定界符 ===
      const createDelimWidget = (text: string, cls?: string) => () => {
        const span = document.createElement('span');
        span.className = 'mark-delimiter' + (cls ? ' ' + cls : '');
        span.textContent = text;
        return span;
      };

      const nav: DelimNav | null = delimNavKey.getState(state) ?? null;
      const { starting, ending, marksBefore, marksAfter } = getMarkBoundaries($from);

      // 收集所有有边界的 mark 名称
      const boundaryMarkNames = new Set<string>();
      starting.forEach((m: any) => boundaryMarkNames.add(m.type.name));
      ending.forEach((m: any) => boundaryMarkNames.add(m.type.name));

      for (const markName of boundaryMarkNames) {
        const range = findMarkRange($from, markName);
        if (!range) continue;
        const delim = markDelimiters[markName];

        // 检查是否有导航状态要分拆定界符
        if (nav && nav.pmPos === selection.from && nav.markName === markName) {
          const step = nav.step;
          if (nav.side === 'start') {
            // 光标在开头定界符内部：左边 step 个字符，右边剩余字符
            const left = delim.slice(0, step);
            const right = delim.slice(step);
            decorations.push(Decoration.widget(range.from, createDelimWidget(left), { side: -1 }));
            if (right) decorations.push(Decoration.widget(range.from, createDelimWidget(right), { side: 1 }));
            // 结尾定界符正常显示
            decorations.push(Decoration.widget(range.to, createDelimWidget(delim), { side: 1 }));
          } else {
            // 光标在结尾定界符内部：左边 step 个字符，右边剩余字符
            const left = delim.slice(0, step);
            const right = delim.slice(step);
            // 开头定界符正常显示
            decorations.push(Decoration.widget(range.from, createDelimWidget(delim), { side: -1 }));
            decorations.push(Decoration.widget(range.to, createDelimWidget(left), { side: -1 }));
            if (right) decorations.push(Decoration.widget(range.to, createDelimWidget(right), { side: 1 }));
          }
        } else {
          // 正常显示完整定界符
          decorations.push(Decoration.widget(range.from, createDelimWidget(delim), { side: -1 }));
          decorations.push(Decoration.widget(range.to, createDelimWidget(delim), { side: 1 }));
        }
      }

      // 链接定界符
      const linkBefore = marksBefore.find((m: any) => m.type.name === 'link');
      const linkAfter = marksAfter.find((m: any) => m.type.name === 'link');
      if ((linkAfter && !linkBefore) || (linkBefore && !linkAfter)) {
        const range = findMarkRange($from, 'link');
        if (range) {
          const linkMark = linkBefore || linkAfter;
          const href = linkMark!.attrs.href || '';
          const title = linkMark!.attrs.title;
          const urlPart = title ? `](${href} "${title}")` : `](${href})`;
          decorations.push(Decoration.widget(range.from, createDelimWidget('['), { side: -1 }));
          decorations.push(Decoration.widget(range.to, createDelimWidget(urlPart), { side: 1 }));
        }
      }

      return DecorationSet.create(doc, decorations);
    }
  },
  appendTransaction(_transactions: readonly Transaction[], _oldState: EditorState, newState: EditorState): Transaction | void {
    void _transactions;
    void _oldState;
    const pluginState = sourceRevealPlugin.getState(newState);
    if (!pluginState) return;
    const { markerEdit, kind, nodePos, textFrom } = pluginState;
    const tr: Transaction = newState.tr;

    // 光标到标题首字符前时，自动显示真实前缀并进入编辑态
    if (!markerEdit && newState.selection.empty) {
      const ctx = findMarkerContext(newState);
      if (ctx) {
        const prefix = readPrefix(newState, ctx);
        if (prefix.len === 0) {
          let text = '';
          if (ctx.kind === 'heading') text = `${'#'.repeat(ctx.level || 1)} `;
          if (ctx.kind === 'blockquote') text = `> `;
          if (ctx.kind === 'bullet') text = `- `;
          if (ctx.kind === 'task') text = `- [${ctx.checked ? 'x' : ' '}] `;
          tr.insertText(text, ctx.textFrom);
          tr.setSelection(TextSelection.create(tr.doc, ctx.textFrom + text.length));
          tr.setMeta(sourceRevealPlugin, {
            markerEdit: true,
            kind: ctx.kind,
            nodePos: ctx.nodePos,
            textFrom: ctx.textFrom,
            level: ctx.level || 0,
            checked: ctx.checked
          });
          return tr;
        }
      }
    }

    // 进入编辑态：在标题开头插入真实的 ## 文本
    if (markerEdit && kind && nodePos !== null && textFrom !== null) {
      const ctx = { kind, nodePos, textFrom };
      const prefix = readPrefix(newState, ctx);

      const offset = newState.selection.$from.parentOffset;
      const node = newState.doc.nodeAt(nodePos);
      const blockFrom = node ? nodePos + 1 : 0;
      const blockTo = node ? nodePos + node.nodeSize - 1 : 0;
      const outsideBlock = node ? (newState.selection.from < blockFrom || newState.selection.from > blockTo) : true;
      const shouldExit = outsideBlock || offset > prefix.len || prefix.len === 0;

      // 光标离开前缀区，退出编辑并清理前缀
      if (shouldExit) {
        if (prefix.len > 0) {
          tr.delete(textFrom, textFrom + prefix.len);
        }

        if (kind === 'heading') {
          if (prefix.level > 0) {
            setBlockTypeForNode(tr, nodePos, mySchema.nodes.heading, { level: prefix.level });
          } else {
            setBlockTypeForNode(tr, nodePos, mySchema.nodes.paragraph);
          }
        }
        if (kind === 'blockquote') {
          if (prefix.level === 0) {
            unwrapBlockquote(tr, nodePos);
          }
        }
        if (kind === 'task') {
          if (prefix.len > 0) {
            tr.setNodeMarkup(nodePos, undefined, { checked: prefix.checked });
          } else {
            const liftedTr = liftListItemAt(newState, mySchema.nodes.task_item);
            if (liftedTr) {
              liftedTr.setMeta(sourceRevealPlugin, { markerEdit: false, kind: null, nodePos: null, textFrom: null, level: 0, checked: false });
              return liftedTr;
            }
          }
        }
        if (kind === 'bullet') {
          if (prefix.len === 0) {
            const liftedTr = liftListItemAt(newState, mySchema.nodes.list_item);
            if (liftedTr) {
              liftedTr.setMeta(sourceRevealPlugin, { markerEdit: false, kind: null, nodePos: null, textFrom: null, level: 0, checked: false });
              return liftedTr;
            }
          }
        }

        tr.setMeta(sourceRevealPlugin, { markerEdit: false, kind: null, nodePos: null, textFrom: null, level: 0, checked: false });
        return tr;
      }

      // 编辑态下，根据当前前缀实时更新标题级别或任务勾选
      if (kind === 'heading' && prefix.level > 0) {
        setBlockTypeForNode(tr, nodePos, mySchema.nodes.heading, { level: prefix.level });
        return tr;
      }
      if (kind === 'task') {
        tr.setNodeMarkup(nodePos, undefined, { checked: prefix.checked });
        return tr;
      }
    }
    return;
  }
});
