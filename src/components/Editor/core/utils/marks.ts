import type { ResolvedPos } from 'prosemirror-model';

// 行内标记定界符映射
export const markDelimiters: Record<string, string> = {
  strong: '**', em: '*', code: '`',
  strikethrough: '~~', highlight: '==',
  subscript: '~', superscript: '^',
};

// 查找光标处某 mark 的连续范围
export function findMarkRange($pos: ResolvedPos, markName: string): { from: number; to: number } | null {
  const parent = $pos.parent;
  const start = $pos.start();
  const cursorOffset = $pos.parentOffset;
  const ranges: { from: number; to: number }[] = [];
  let cur: { from: number; to: number } | null = null;

  parent.forEach((child: any, offset: number) => {
    if (child.marks.some((m: any) => m.type.name === markName)) {
      if (!cur) cur = { from: offset, to: offset + child.nodeSize };
      else cur.to = offset + child.nodeSize;
    } else {
      if (cur) { ranges.push(cur); cur = null; }
    }
  });
  if (cur) ranges.push(cur);

  for (const r of ranges) {
    if (cursorOffset >= r.from && cursorOffset <= r.to) {
      return { from: start + r.from, to: start + r.to };
    }
  }
  return null;
}

// 检测光标处哪些 mark 有边界
export function getMarkBoundaries($from: ResolvedPos) {
  const marksBefore = $from.nodeBefore?.marks || [];
  const marksAfter = $from.nodeAfter?.marks || [];
  const starting = marksAfter.filter(
    (m: any) => markDelimiters[m.type.name] && !marksBefore.some((mb: any) => mb.type.name === m.type.name)
  );
  const ending = marksBefore.filter(
    (m: any) => markDelimiters[m.type.name] && !marksAfter.some((ma: any) => ma.type.name === m.type.name)
  );
  return { starting, ending, marksBefore, marksAfter };
}
