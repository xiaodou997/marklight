import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

import { markDelimiters, findMarkRange, getMarkBoundaries } from '../utils/marks';
import { delimNavKey, type DelimNav } from './delim-nav';
import { mySchema } from '../schema';

type SourceRevealState = {
  markerEdit: boolean;
  headingPos: number | null;
  level: number;
};

let currentView: EditorView | null = null;

function applyHeadingLevel(level: number) {
  if (!currentView) return;
  const { state, dispatch } = currentView;
  const { $from } = state.selection;
  const from = $from.start($from.depth);
  const to = $from.end($from.depth);
  if (level <= 0) {
    dispatch(state.tr.setBlockType(from, to, mySchema.nodes.paragraph));
    return;
  }
  const safeLevel = Math.min(Math.max(level, 1), 6);
  dispatch(state.tr.setBlockType(from, to, mySchema.nodes.heading, { level: safeLevel }));
}

function moveSelectionToHeadingStart(pos: number) {
  if (!currentView) return;
  const { state, dispatch } = currentView;
  const sel = TextSelection.create(state.doc, pos + 1);
  dispatch(state.tr.setSelection(sel));
  currentView.focus();
}

function moveSelectionToPrev(pos: number) {
  if (!currentView) return;
  const { state, dispatch } = currentView;
  const sel = TextSelection.near(state.doc.resolve(pos), -1);
  dispatch(state.tr.setSelection(sel));
  currentView.focus();
}

function getHeadingInfo(state: any, pos: number) {
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'heading') return null;
  return {
    node,
    from: pos + 1,
    to: pos + node.nodeSize - 1
  };
}

function readHeadingPrefix(state: any, pos: number) {
  const info = getHeadingInfo(state, pos);
  if (!info) return { level: 0, len: 0 };
  const to = Math.min(info.from + 16, info.to);
  const text = state.doc.textBetween(info.from, to, '\n', '\n');
  const match = text.match(/^(#{1,6})(\s?)/);
  if (!match) return { level: 0, len: 0 };
  return { level: match[1].length, len: match[0].length };
}

// 高亮当前节点 + 显示定界符的插件
export const sourceRevealPlugin = new Plugin<SourceRevealState>({
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
      return { markerEdit: false, headingPos: null, level: 0 };
    },
    apply(tr, prev, _old, next) {
      const meta = tr.getMeta(sourceRevealPlugin);
      if (meta) {
        return { ...prev, ...meta };
      }
      const mappedPos = prev.headingPos !== null ? tr.mapping.map(prev.headingPos) : null;
      return { ...prev, headingPos: mappedPos };
    }
  },
  props: {
    handleKeyDown(view, event) {
      const state = sourceRevealPlugin.getState(view.state);
      if (!state) return false;

      if (state.markerEdit) {
        if (state.headingPos === null) return false;
        const info = getHeadingInfo(view.state, state.headingPos);
        if (!info) return false;
        const prefix = readHeadingPrefix(view.state, state.headingPos);
        const pos = view.state.selection.from;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          if (pos > info.from) {
            const nextPos = Math.max(info.from, pos - 1);
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, nextPos)));
            return true;
          }
          moveSelectionToPrev(state.headingPos);
          view.dispatch(view.state.tr.setMeta(sourceRevealPlugin, { markerEdit: false }));
          return true;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          const end = info.from + prefix.len;
          if (pos < end) {
            const nextPos = Math.min(end, pos + 1);
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, nextPos)));
            return true;
          }
          moveSelectionToHeadingStart(state.headingPos);
          view.dispatch(view.state.tr.setMeta(sourceRevealPlugin, { markerEdit: false }));
          return true;
        }
        // 其他按键退出编辑态，交给编辑器处理
        return false;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;
      if (!view.state.selection.empty) return false;
      const { $from } = view.state.selection;
      if ($from.parent.type.name !== 'heading') return false;
      if ($from.parentOffset !== 0) return false;
      const pos = $from.before($from.depth);
      const level = $from.parent.attrs.level || 1;
      event.preventDefault();
      const info = getHeadingInfo(view.state, pos);
      if (!info) return false;
      const prefix = readHeadingPrefix(view.state, pos);
      let tr = view.state.tr;
      if (prefix.level === 0) {
        const text = `${'#'.repeat(level)} `;
        tr = tr.insertText(text, info.from);
      }
      const newPrefix = readHeadingPrefix({ doc: tr.doc } as any, pos);
      const cursorPos = info.from + newPrefix.len;
      tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos));
      tr = tr.setMeta(sourceRevealPlugin, { markerEdit: true, headingPos: pos, level });
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

      // 检测光标是否在引用块第一个段落开头，显示 > 标记
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'blockquote') {
          if ($from.parentOffset === 0 && $from.index(d) === 0) {
            const pos = $from.before(d);
            decorations.push(Decoration.node(pos, pos + node.nodeSize, {
              class: 'show-marker'
            }));
          }
          break;
        }
      }

      // 检测光标是否在列表项开头，显示列表标记
      if ($from.parent.type.name === 'task_item' && $from.parentOffset === 0) {
        const d = $from.depth;
        const pos = $from.before(d);
        decorations.push(Decoration.node(pos, pos + $from.parent.nodeSize, {
          class: 'show-marker'
        }));
      }
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'list_item') {
          if ($from.parentOffset === 0 && $from.index(d) === 0) {
            const listItemPos = $from.before(d);
            decorations.push(Decoration.node(listItemPos, listItemPos + node.nodeSize, {
              class: 'show-marker'
            }));
          }
          break;
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
  appendTransaction(transactions, oldState, newState) {
    const pluginState = sourceRevealPlugin.getState(newState);
    if (!pluginState) return;
    const { markerEdit, headingPos, level } = pluginState;
    const tr = newState.tr;

    // 进入编辑态：在标题开头插入真实的 ## 文本
    if (markerEdit && headingPos !== null) {
      const info = getHeadingInfo(newState, headingPos);
      if (!info) {
        return tr.setMeta(sourceRevealPlugin, { markerEdit: false, headingPos: null, level: 0 });
      }
      const prefix = readHeadingPrefix(newState, headingPos);
      if (prefix.level === 0) {
        const text = `${'#'.repeat(level)} `;
        tr.insertText(text, info.from);
        tr.setSelection(TextSelection.create(tr.doc, info.from + level));
        return tr;
      }
      // 光标离开前缀区，退出编辑并清理前缀
      if (newState.selection.$from.parentOffset > prefix.len) {
        if (prefix.len > 0) {
          tr.delete(info.from, info.from + prefix.len);
        }
        if (prefix.level > 0) {
          tr.setBlockType(info.from, info.to - prefix.len, mySchema.nodes.heading, { level: prefix.level });
        } else {
          tr.setBlockType(info.from, info.to, mySchema.nodes.paragraph);
        }
        tr.setMeta(sourceRevealPlugin, { markerEdit: false, headingPos: null, level: 0 });
        return tr;
      }
      // 编辑态下，根据当前前缀实时更新标题级别
      if (prefix.level > 0 && prefix.level !== info.node.attrs.level) {
        tr.setBlockType(info.from, info.to, mySchema.nodes.heading, { level: prefix.level });
        return tr;
      }
      if (prefix.level === 0) {
        tr.setBlockType(info.from, info.to, mySchema.nodes.paragraph);
        return tr;
      }
    }

    // 离开标题或移动到正文时，清理前缀并更新级别
    if (headingPos !== null) {
      const info = getHeadingInfo(newState, headingPos);
      const inSameHeading = info && newState.selection.$from.parent.type.name === 'heading'
        && newState.selection.$from.start(newState.selection.$from.depth) === info.from;
      if (!markerEdit && !inSameHeading) {
        if (info) {
          const prefix = readHeadingPrefix(newState, headingPos);
          if (prefix.level > 0 && prefix.len > 0) {
            tr.delete(info.from, info.from + prefix.len);
            tr.setBlockType(info.from, info.to - prefix.len, mySchema.nodes.heading, { level: prefix.level });
          } else if (prefix.len === 0) {
            tr.setBlockType(info.from, info.to, mySchema.nodes.paragraph);
          }
        }
        tr.setMeta(sourceRevealPlugin, { markerEdit: false, headingPos: null, level: 0 });
        return tr;
      }
    }
    return;
  }
});
