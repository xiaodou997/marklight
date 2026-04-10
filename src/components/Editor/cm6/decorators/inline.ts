import { type Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

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

/**
 * 处理行内 Markdown 装饰：
 * 粗体、斜体、删除线、上标、下标、行内代码、高亮、链接、#标签
 */
export function decorateInline(
  out: Range<Decoration>[],
  lineFrom: number,
  text: string,
  active: boolean
) {
  const decoratePair = (re: RegExp, markClass: string, markLen: number) => {
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(text)) !== null) {
      const full = match[0];
      const inner = match[1] ?? '';
      const at = match.index;
      const fullFrom = lineFrom + at;
      const innerFrom = fullFrom + markLen;
      const innerTo = innerFrom + inner.length;
      const fullTo = fullFrom + full.length;

      if (active) {
        addMark(out, fullFrom, innerFrom, 'mk-syntax-mark');
        addMark(out, innerTo, fullTo, 'mk-syntax-mark');
      } else {
        addHidden(out, fullFrom, innerFrom);
        addMark(out, innerFrom, innerTo, markClass);
        addHidden(out, innerTo, fullTo);
      }
    }
  };

  decoratePair(/\*\*([^*\n]+)\*\*/g, 'mk-strong', 2);
  decoratePair(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, 'mk-emphasis', 1);
  decoratePair(/~~([^~\n]+)~~/g, 'mk-strikethrough', 2);
  decoratePair(/(?<!~)~([^~\n]+)~(?!~)/g, 'mk-sub', 1);
  decoratePair(/\^([^^\n]+)\^/g, 'mk-sup', 1);
  decoratePair(/`([^`\n]+)`/g, 'mk-inline-code', 1);
  decoratePair(/==([^=\n]+)==/g, 'mk-highlight', 2);

  // 链接：[label](url)
  let linkMatch: RegExpExecArray | null;
  const linkRe = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;
  while ((linkMatch = linkRe.exec(text)) !== null) {
    // 跳过图片 ![...]
    if (linkMatch.index > 0 && text[linkMatch.index - 1] === '!') continue;
    const at = linkMatch.index;
    const label = linkMatch[1] ?? '';
    const url = linkMatch[2] ?? '';
    const start = lineFrom + at;
    const labelFrom = start + 1;
    const labelTo = labelFrom + label.length;
    const urlFrom = labelTo + 2; // ](
    const end = urlFrom + url.length + 1; // )

    if (active) {
      addMark(out, start, labelFrom, 'mk-syntax-mark');
      addMark(out, labelTo, end, 'mk-syntax-mark');
    } else {
      addHidden(out, start, labelFrom);
      addMark(out, labelFrom, labelTo, 'mk-link');
      addHidden(out, labelTo, end);
    }
  }

  // Wikilink：[[page]] 或 [[page|alias]] 或 [[page#heading]]
  const wikilinkRe = /\[\[([^\]\n]+)\]\]/g;
  let wikiMatch: RegExpExecArray | null;
  while ((wikiMatch = wikilinkRe.exec(text)) !== null) {
    const at = wikiMatch.index;
    const inner = wikiMatch[1] ?? '';
    const fullFrom = lineFrom + at;
    const fullTo = fullFrom + wikiMatch[0].length;
    const innerFrom = fullFrom + 2;
    // 显示文字：[[page|alias]] 取 alias，否则取 page（去掉 #heading 部分）
    const displayText = inner.includes('|')
      ? inner.split('|')[1]
      : inner.split('#')[0];
    const displayEnd = innerFrom + displayText.length;

    if (active) {
      addMark(out, fullFrom, fullTo, 'mk-syntax-mark');
    } else {
      addHidden(out, fullFrom, innerFrom);
      out.push(
        Decoration.mark({ class: 'mk-wikilink', attributes: { 'data-wikilink': inner } })
          .range(innerFrom, displayEnd)
      );
      addHidden(out, displayEnd, fullTo);
    }
  }

  // #标签：匹配 #tag、#tag/subtag（不匹配纯数字、不匹配标题）
  // 只在非行首位置（行首 # 是标题），或者前面有空格/标点的位置
  const tagRe = /(?:^|\s)(#([\u4e00-\u9fa5a-zA-Z][\u4e00-\u9fa5a-zA-Z0-9\-_/]*))/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRe.exec(text)) !== null) {
    const fullMatch = tagMatch[1] ?? '';
    // 计算 # 在行内的偏移（跳过前导空白）
    const hashOffset = tagMatch.index + (tagMatch[0].length - fullMatch.length);
    const tagFrom = lineFrom + hashOffset;
    const tagTo = tagFrom + fullMatch.length;

    if (active) {
      addMark(out, tagFrom, tagTo, 'mk-syntax-mark');
    } else {
      out.push(Decoration.mark({ class: 'mk-tag' }).range(tagFrom, tagTo));
    }
  }
}
