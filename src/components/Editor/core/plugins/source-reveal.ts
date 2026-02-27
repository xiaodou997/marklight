import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { markDelimiters, findMarkRange, getMarkBoundaries } from '../utils/marks';
import { delimNavKey, type DelimNav } from './delim-nav';

// 高亮当前节点 + 显示定界符的插件
export const sourceRevealPlugin = new Plugin({
  key: new PluginKey('source-reveal'),
  props: {
    decorations(state) {
      const { selection, doc } = state;
      if (!selection.empty) return DecorationSet.empty;

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

      // 检测光标是否在标题开头，显示 # 标记
      if ($from.parent.type.name === 'heading' && $from.parentOffset === 0) {
        const pos = $from.before($from.depth);
        const node = $from.parent;
        decorations.push(Decoration.node(pos, pos + node.nodeSize, {
          class: 'show-marker'
        }));
      }

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
  }
});
