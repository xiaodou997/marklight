import { Plugin, PluginKey } from 'prosemirror-state';

import { markDelimiters, findMarkRange, getMarkBoundaries } from '../utils/marks';
import { buildParagraphMap, deleteInParagraph, getCursorPara } from '../utils/paragraph-mapping';

// 定界符导航状态
export interface DelimNav {
  pmPos: number;           // PM 光标位置
  markName: string;
  side: 'start' | 'end';  // 在标记的开头还是结尾
  step: number;            // 深入定界符的步数（1..delimLen）
}

export const delimNavKey = new PluginKey<DelimNav | null>('delim-nav');

export const delimNavPlugin = new Plugin({
  key: delimNavKey,
  state: {
    init(): DelimNav | null { return null; },
    apply(tr, value): DelimNav | null {
      const meta = tr.getMeta(delimNavKey);
      if (meta !== undefined) return meta;
      if (tr.docChanged || tr.selectionSet) return null;
      return value;
    }
  },
  props: {
    handleKeyDown(view, event) {
      const { state } = view;
      const { selection } = state;
      if (!selection.empty) return false;
      const $from = selection.$from;
      const nav = delimNavKey.getState(state);

      // 计算导航中的虚拟源码位置
      const getVirtualSrcPos = (n: DelimNav, map: { pmToSrcBC: number[]; pmToSrcAO: number[] }, paraStart: number, range: { from: number; to: number }): number => {
        const relFrom = range.from - paraStart - 1;
        const relTo = range.to - paraStart - 1;
        return n.side === 'start'
          ? map.pmToSrcAO[relFrom] - n.step
          : map.pmToSrcBC[relTo] + n.step;
      };

      // ===== ArrowLeft：穿过开头定界符 =====
      if (event.key === 'ArrowLeft') {
        if (nav && nav.pmPos === selection.from && nav.side === 'start') {
          const delim = markDelimiters[nav.markName];
          if (nav.step >= delim.length) {
            view.dispatch(state.tr.setMeta(delimNavKey, null));
            return false;
          }
          view.dispatch(state.tr.setMeta(delimNavKey, { ...nav, step: nav.step + 1 }));
          return true;
        }
        if (nav && nav.pmPos === selection.from && nav.side === 'end') {
          view.dispatch(state.tr.setMeta(delimNavKey, null));
          return false;
        }
        const { starting } = getMarkBoundaries($from);
        for (const m of starting) {
          if ((markDelimiters[m.type.name] ?? '').length > 1) {
            view.dispatch(state.tr.setMeta(delimNavKey, { pmPos: selection.from, markName: m.type.name, step: 1, side: 'start' as const }));
            return true;
          }
        }
        return false;
      }

      // ===== ArrowRight：穿过结尾定界符 =====
      if (event.key === 'ArrowRight') {
        if (nav && nav.pmPos === selection.from && nav.side === 'end') {
          const delim = markDelimiters[nav.markName];
          if (nav.step >= delim.length) {
            view.dispatch(state.tr.setMeta(delimNavKey, null));
            return false;
          }
          view.dispatch(state.tr.setMeta(delimNavKey, { ...nav, step: nav.step + 1 }));
          return true;
        }
        if (nav && nav.pmPos === selection.from && nav.side === 'start') {
          view.dispatch(state.tr.setMeta(delimNavKey, null));
          return false;
        }
        const { ending } = getMarkBoundaries($from);
        for (const m of ending) {
          if ((markDelimiters[m.type.name] ?? '').length > 1) {
            view.dispatch(state.tr.setMeta(delimNavKey, { pmPos: selection.from, markName: m.type.name, step: 1, side: 'end' as const }));
            return true;
          }
        }
        return false;
      }

      // ===== Backspace：源码层面删除 =====
      if (event.key === 'Backspace') {
        const cp = getCursorPara($from);
        if (!cp) return false;
        const { para, paraStart } = cp;
        const map = buildParagraphMap(para);

        // 在导航状态中（光标在定界符内部）
        if (nav && nav.pmPos === selection.from) {
          const range = findMarkRange($from, nav.markName);
          if (!range) return false;
          const virtualSrcPos = getVirtualSrcPos(nav, map, paraStart, range);
          return deleteInParagraph(view, para, paraStart, virtualSrcPos - 1);
        }

        // 在标记开头边界（光标紧贴开头定界符右侧）
        const { starting } = getMarkBoundaries($from);
        for (const m of starting) {
          const range = findMarkRange($from, m.type.name);
          if (!range) continue;
          const relFrom = range.from - paraStart - 1;
          const afterOpenPos = map.pmToSrcAO[relFrom];
          return deleteInParagraph(view, para, paraStart, afterOpenPos - 1);
        }
        return false;
      }

      // ===== Delete：源码层面向前删除 =====
      if (event.key === 'Delete') {
        const cp = getCursorPara($from);
        if (!cp) return false;
        const { para, paraStart } = cp;
        const map = buildParagraphMap(para);

        // 在导航状态中
        if (nav && nav.pmPos === selection.from) {
          const range = findMarkRange($from, nav.markName);
          if (!range) return false;
          const virtualSrcPos = getVirtualSrcPos(nav, map, paraStart, range);
          return deleteInParagraph(view, para, paraStart, virtualSrcPos);
        }

        // 在标记结尾边界（光标紧贴结尾定界符左侧）
        const { ending } = getMarkBoundaries($from);
        for (const m of ending) {
          const range = findMarkRange($from, m.type.name);
          if (!range) continue;
          const relTo = range.to - paraStart - 1;
          const beforeClosePos = map.pmToSrcBC[relTo];
          return deleteInParagraph(view, para, paraStart, beforeClosePos);
        }
        return false;
      }

      // 其他按键重置导航状态
      if (nav) { view.dispatch(state.tr.setMeta(delimNavKey, null)); }
      return false;
    }
  }
});
