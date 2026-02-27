import { TextSelection } from 'prosemirror-state';
import type { Schema, Node, ResolvedPos } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

import { markDelimiters } from './marks';
import { parseMarkdown } from '../markdown';

// 构建段落源码映射
// pmToSrcBC[i] = 源码位置（关闭定界符之前，range.to 视角）
// pmToSrcAO[i] = 源码位置（打开定界符之后，range.from 视角）
export function buildParagraphMap(para: Node): { source: string; pmToSrcBC: number[]; pmToSrcAO: number[] } {
  const size = para.content.size;
  const pmToSrcBC = new Array(size + 1).fill(0);
  const pmToSrcAO = new Array(size + 1).fill(0);
  let source = '';
  let srcPos = 0;
  let prevMarks: any[] = [];

  para.forEach((child: any, off: number) => {
    const childMarks: any[] = child.isText ? [...child.marks] : [];
    const closing = prevMarks.filter((m: any) => !childMarks.some((cm: any) => cm.type.name === m.type.name));
    const opening = childMarks.filter((m: any) => !prevMarks.some((pm: any) => pm.type.name === m.type.name));

    // 在关闭定界符之前记录位置（range.to 视角）
    pmToSrcBC[off] = srcPos;
    for (const m of closing) { const d = markDelimiters[m.type.name] ?? ''; source += d; srcPos += d.length; }
    for (const m of opening) { const d = markDelimiters[m.type.name] ?? ''; source += d; srcPos += d.length; }
    // 在打开定界符之后记录位置（range.from 视角）
    pmToSrcAO[off] = srcPos;

    if (child.isText) {
      const text = child.text as string;
      // i=0 的位置已由上面设置，从 i=1 开始填充中间位置
      for (let i = 1; i < text.length; i++) {
        pmToSrcBC[off + i] = srcPos + i;
        pmToSrcAO[off + i] = srcPos + i;
      }
      source += text;
      srcPos += text.length;
    }
    prevMarks = childMarks;
  });

  // 最后剩余 mark 的关闭定界符
  pmToSrcBC[size] = srcPos;
  for (const m of [...prevMarks].reverse()) { const d = markDelimiters[m.type.name] ?? ''; source += d; srcPos += d.length; }
  pmToSrcAO[size] = srcPos;

  return { source, pmToSrcBC, pmToSrcAO };
}

// 将源码字符串解析为行内节点
export function parseInlineNodes(source: string, schema: Schema): readonly any[] {
  try {
    const doc = parseMarkdown(source.trim(), schema);
    if (doc.firstChild?.type.name === 'paragraph') {
      const nodes: any[] = [];
      doc.firstChild.forEach((n: any) => nodes.push(n));
      return nodes;
    }
  } catch { /* ignore */ }
  return source ? [schema.text(source)] : [];
}

// 源码层面删除段落中某个字符，重新解析并替换段落
// 注意：dispatching 的 tr 修改了文档，delimNavPlugin 会自动通过 tr.docChanged 重置导航状态
export function deleteInParagraph(
  view: EditorView,
  para: Node,
  paraStart: number,
  deleteSrcPos: number
): boolean {
  const { source } = buildParagraphMap(para);
  if (deleteSrcPos < 0 || deleteSrcPos >= source.length) return false;

  const newSource = source.slice(0, deleteSrcPos) + source.slice(deleteSrcPos + 1);
  const newNodes = parseInlineNodes(newSource, view.state.schema);

  const from = paraStart + 1;
  const to = paraStart + 1 + para.content.size;
  const tr = view.state.tr;
  if (newNodes.length > 0) tr.replaceWith(from, to, newNodes as any);
  else tr.delete(from, to);

  // 找到新段落中对应 deleteSrcPos 的 PM 偏移，恢复光标
  try {
    const newPara = tr.doc.resolve(from).parent;
    if (newPara && newPara.content) {
      const { pmToSrcBC: nb } = buildParagraphMap(newPara);
      let bestOff = 0;
      for (let o = 0; o <= newPara.content.size; o++) {
        if (nb[o] <= deleteSrcPos) bestOff = o;
      }
      tr.setSelection(TextSelection.create(tr.doc, from + bestOff));
    }
  } catch { /* ignore cursor restoration error */ }

  view.dispatch(tr);
  return true;
}

// 获取光标所在的行内容器节点
export function getCursorPara($from: ResolvedPos): { para: Node; paraStart: number } | null {
  const parent = $from.parent;
  const inlineContainers = ['paragraph', 'heading', 'task_item', 'definition_term', 'definition_description'];
  if (inlineContainers.includes(parent.type.name)) {
    return { para: parent, paraStart: $from.before($from.depth) };
  }
  return null;
}
