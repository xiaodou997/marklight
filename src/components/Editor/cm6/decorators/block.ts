import { type Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { PrefixWidget } from '../widgets/PrefixWidget';
import { HorizontalRuleWidget } from '../widgets/HorizontalRuleWidget';
import { TaskPrefixWidget } from '../widgets/TaskPrefixWidget';
import { decorateInline } from './inline';

function addMark(
  out: Range<Decoration>[],
  from: number,
  to: number,
  className: string
) {
  if (from >= to) return;
  out.push(Decoration.mark({ class: className }).range(from, to));
}

function addHidden(out: Range<Decoration>[], from: number, to: number) {
  if (from >= to) return;
  out.push(Decoration.replace({}).range(from, to));
}

function addWidget(
  out: Range<Decoration>[],
  from: number,
  to: number,
  text: string,
  className: string
) {
  if (from >= to) return;
  out.push(Decoration.replace({ widget: new PrefixWidget(text, className) }).range(from, to));
}

/**
 * 处理列表/任务列表/有序列表/行内装饰（可复用于引用块内的余下内容）
 */
export function decorateListOrInline(
  out: Range<Decoration>[],
  lineFrom: number,
  lineTo: number,
  text: string,
  active: boolean,
  indentOffset = 0
) {
  const taskMatch = text.match(/^(\s*)([-+*]\s+\[[ xX]\]\s+)/);
  if (taskMatch) {
    const indentLen = taskMatch[1].length;
    const markerLen = taskMatch[2].length;
    const checked = /\[[xX]\]/.test(taskMatch[2]);
    const start = lineFrom + indentOffset + indentLen;
    if (active) {
      addMark(out, start, start + markerLen, 'mk-syntax-mark');
    } else {
      out.push(Decoration.replace({ widget: new TaskPrefixWidget(checked) }).range(start, start + markerLen));
      addMark(out, start + markerLen, lineTo, 'mk-list-item');
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  const orderedMatch = text.match(/^(\s*)(\d+[.)]\s+)/);
  if (orderedMatch) {
    const indentLen = orderedMatch[1].length;
    const marker = orderedMatch[2].trim();
    const markerLen = orderedMatch[2].length;
    const start = lineFrom + indentOffset + indentLen;
    if (active) {
      addMark(out, start, start + markerLen, 'mk-syntax-mark');
    } else {
      addWidget(out, start, start + markerLen, `${marker} `, 'mk-list-prefix');
      addMark(out, start + markerLen, lineTo, 'mk-list-item');
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  const bulletMatch = text.match(/^(\s*)([-+*]\s+)/);
  if (bulletMatch) {
    const indentLen = bulletMatch[1].length;
    const markerLen = bulletMatch[2].length;
    const marker = bulletMatch[2].trim();
    const start = lineFrom + indentOffset + indentLen;
    if (active) {
      addMark(out, start, start + markerLen, 'mk-syntax-mark');
    } else {
      addWidget(out, start, start + markerLen, `${marker} `, 'mk-list-prefix');
      addMark(out, start + markerLen, lineTo, 'mk-list-item');
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  decorateInline(out, lineFrom, text, active);
}

/**
 * 处理单行的块级 Markdown 装饰
 */
export function decorateLine(
  out: Range<Decoration>[],
  lineFrom: number,
  lineTo: number,
  text: string,
  active: boolean
) {
  // 水平线
  const isHr = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text);
  if (isHr) {
    if (active) {
      addMark(out, lineFrom, lineTo, 'mk-syntax-mark');
    } else {
      out.push(Decoration.replace({ widget: new HorizontalRuleWidget() }).range(lineFrom, lineTo));
    }
    return;
  }

  // 标题
  const headingMatch = text.match(/^(#{1,6})\s+/);
  if (headingMatch) {
    const prefixLen = headingMatch[0].length;
    const level = headingMatch[1].length;
    if (active) {
      addMark(out, lineFrom, lineFrom + prefixLen, `mk-syntax-mark mk-heading mk-heading-${level}`);
      addMark(out, lineFrom + prefixLen, lineTo, `mk-heading mk-heading-${level}`);
    } else {
      addHidden(out, lineFrom, lineFrom + prefixLen);
      addMark(out, lineFrom + prefixLen, lineTo, `mk-heading mk-heading-${level}`);
    }
    decorateInline(out, lineFrom, text, active);
    return;
  }

  // 引用块（支持内部嵌套列表）
  const quoteMatch = text.match(/^(\s*>+\s?)/);
  if (quoteMatch) {
    const prefixLen = quoteMatch[1].length;
    const restText = text.slice(prefixLen);
    if (active) {
      addMark(out, lineFrom, lineFrom + prefixLen, 'mk-syntax-mark');
    } else {
      out.push(Decoration.line({ class: 'mk-blockquote-line' }).range(lineFrom));
      addHidden(out, lineFrom, lineFrom + prefixLen);
      // 只有当引用块内容不是列表/任务项时才添加 mk-blockquote mark。
      // 列表项会在同起始位置添加 replace-widget（不能与 mark 重叠）。
      const hasListMarker = /^(\s*)([-+*]\s|\d+[.)]\s|\[[ xX]\]\s)/.test(restText);
      if (!hasListMarker) {
        addMark(out, lineFrom + prefixLen, lineTo, 'mk-blockquote');
      }
    }
    // 递归处理引用块内的余下内容（支持 "> * 列表"、"> - [ ] 任务"、"> 1. 有序" 等嵌套）
    decorateListOrInline(out, lineFrom + prefixLen, lineTo, restText, active);
    return;
  }

  // 列表 / 任务 / 有序（委托给 decorateListOrInline）
  decorateListOrInline(out, lineFrom, lineTo, text, active);
}
