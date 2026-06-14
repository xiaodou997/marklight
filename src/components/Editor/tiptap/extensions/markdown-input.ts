/**
 * 统一 Markdown 输入引擎
 *
 * 编辑器走纯 WYSIWYG：markdown 标记输入即转换为真实 marks/节点，不以字面文本停留。
 * 行内标记（bold/italic/strike/code/highlight/sup/sub）与标题（heading）的转换，
 * 全部由**这一个**插件、**一份** composition 状态驱动，杜绝多插件抢 composition
 * 状态的竞态（这正是历史上行内标记在 IME 下失效的根因）。
 *
 * 三类转换：
 *
 *   1. 行内标记 —— 路径 A：StarterKit/Highlight/sub-sup/wikilink 各自的原生
 *      input rules 负责非 IME 即时转换；路径 B：本插件在非 composition 的文档变更后、
 *      以及 compositionend 收尾时扫描光标前文本兜底转换（覆盖「标记被 IME 一次性提交」）。
 *
 *   2. 标题（pending heading）—— 输入 `# 文字` 时段落保持 paragraph、用 CSS 装饰
 *      模拟标题外观；等输入稳定（非 composition、settle 之后）再转换为真正的 heading。
 *      绝不在空 heading 上让 IME composition 发生，从根本上规避 readDOMChange 错位。
 *
 *   3. 块级 —— 数学块（$$）、Mermaid（```mermaid）的 input rules。
 */
import { Extension, InputRule } from '@tiptap/vue-3';
import { inputRegex as highlightInputRegex } from '@tiptap/extension-highlight';
import {
  starInputRegex as boldStarInputRegex,
  underscoreInputRegex as boldUnderscoreInputRegex,
} from '@tiptap/extension-bold';
import {
  starInputRegex as italicStarInputRegex,
  underscoreInputRegex as italicUnderscoreInputRegex,
} from '@tiptap/extension-italic';
import { inputRegex as strikeInputRegex } from '@tiptap/extension-strike';
import { inputRegexMatch as codeInputRegexMatch } from '@tiptap/extension-code';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { MarkType, Node as PMNode, NodeType } from '@tiptap/pm/model';

// 输入法上屏后等待 DOM/composition 稳定再扫描的延迟（毫秒）。
const IME_SETTLE_DELAY_MS = 50;
// 非 IME 文本输入后，等待停顿再把 pending heading 转成真正 heading 的延迟（毫秒）。
const TEXT_SETTLE_DELAY_MS = 300;
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const markdownInputPluginKey = new PluginKey<MarkdownInputState>('markdownInput');

type MarkdownInputState = {
  composing: boolean;
  forceCheck: boolean;
  suppressUntil: number;
};

type PendingHeading = {
  level: number;
  paragraphPos: number;
  prefixLength: number;
};

type Matcher =
  | RegExp
  | ((text: string) => { index: number; text: string; replaceWith?: string } | null);

type InlineMarkCandidate = {
  name: string;
  finder: Matcher;
};

type InlineMatch = {
  markType: MarkType;
  fullStart: number;
  fullEnd: number;
  openingStart: number;
  innerStart: number;
  innerText: string;
};

const inlineMarkCandidates: InlineMarkCandidate[] = [
  { name: 'code', finder: codeInputRegexMatch },
  { name: 'bold', finder: boldStarInputRegex },
  { name: 'bold', finder: boldUnderscoreInputRegex },
  { name: 'strike', finder: strikeInputRegex },
  { name: 'highlight', finder: highlightInputRegex },
  { name: 'italic', finder: italicStarInputRegex },
  { name: 'italic', finder: italicUnderscoreInputRegex },
  { name: 'superscript', finder: /\^([^^]+)\^$/ },
  { name: 'subscript', finder: /~([^~]+)~$/ },
];

// ── 块级 input rules（数学块、Mermaid）──────────────────────────

/** 输入 $$ 并换行时，创建数学公式块 */
function mathBlockInputRule() {
  return new InputRule({
    find: /^\$\$\s$/,
    handler: ({ state, range }) => {
      const mathBlockType = state.schema.nodes.mathBlock;
      if (!mathBlockType) return;
      const tr = state.tr.delete(range.from, range.to);
      tr.replaceSelectionWith(mathBlockType.create());
    },
  });
}

/** 输入 ```mermaid 并换行时，创建 Mermaid 块 */
function mermaidInputRule() {
  return new InputRule({
    find: /^```mermaid\s$/,
    handler: ({ state, range }) => {
      const mermaidBlockType = state.schema.nodes.mermaidBlock;
      if (!mermaidBlockType) return;
      const tr = state.tr.delete(range.from, range.to);
      tr.replaceSelectionWith(mermaidBlockType.create());
    },
  });
}

export const MarkdownInput = Extension.create({
  name: 'markdownInput',

  addInputRules() {
    return [mathBlockInputRule(), mermaidInputRule()];
  },

  addProseMirrorPlugins() {
    return [markdownInputPlugin()];
  },
});

// 测试基建：导出插件工厂、PluginKey 与状态类型，供 IME/输入编排回归测试驱动
// 状态机（用 meta 事务模拟 compositionstart/end、用 fake timers 推进 Date.now/setTimeout）。
// 仅为可测性增加的 additive export，不改变任何运行时行为或分支。
export { markdownInputPlugin, markdownInputPluginKey };
export type { MarkdownInputState };

function markdownInputPlugin(): Plugin<MarkdownInputState> {
  return new Plugin<MarkdownInputState>({
    key: markdownInputPluginKey,

    state: {
      init() {
        return { composing: false, forceCheck: false, suppressUntil: 0 };
      },
      apply(tr, value) {
        const meta = tr.getMeta(markdownInputPluginKey) as
          | Partial<MarkdownInputState>
          | undefined;
        if (!meta) {
          return { ...value, forceCheck: false };
        }
        return {
          composing: meta.composing ?? value.composing,
          forceCheck: meta.forceCheck ?? false,
          suppressUntil: meta.suppressUntil ?? value.suppressUntil,
        };
      },
    },

    view() {
      let checkTimer: number | null = null;

      function clearCheckTimer() {
        if (checkTimer == null) return;
        window.clearTimeout(checkTimer);
        checkTimer = null;
      }

      function scheduleCheck(view: EditorView, delay: number) {
        clearCheckTimer();
        checkTimer = window.setTimeout(() => {
          checkTimer = null;
          if (view.isDestroyed) return;
          setMarkdownInputState(view, {
            composing: false,
            forceCheck: true,
            suppressUntil: 0,
          });
        }, delay);
      }

      return {
        // 非 IME 文本输入后，pending heading 需要在停顿后转成真正 heading。
        // composition 路径由 compositionend 自己安排 forceCheck，这里只管非 IME。
        update(view, previousState) {
          if (view.state.doc.eq(previousState.doc)) return;

          const pluginState = markdownInputPluginKey.getState(view.state);
          if (pluginState?.composing) {
            clearCheckTimer();
            return;
          }

          if (!findPendingHeading(view.state.doc)) {
            clearCheckTimer();
            return;
          }

          const now = Date.now();
          if (pluginState && pluginState.suppressUntil > now) {
            scheduleCheck(view, pluginState.suppressUntil - now);
            return;
          }

          scheduleCheck(view, TEXT_SETTLE_DELAY_MS);
        },

        destroy() {
          clearCheckTimer();
        },
      };
    },

    props: {
      handleDOMEvents: {
        compositionstart(view) {
          setMarkdownInputState(view, {
            composing: true,
            forceCheck: false,
            suppressUntil: Number.POSITIVE_INFINITY,
          });
          return false;
        },
        compositionend(view) {
          const suppressUntil = Date.now() + IME_SETTLE_DELAY_MS;
          setMarkdownInputState(view, {
            composing: false,
            forceCheck: false,
            suppressUntil,
          });
          // 上屏后等 DOM/composition 稳定，再强制扫描一次（覆盖行内标记与标题）。
          window.setTimeout(() => {
            if (view.isDestroyed) return;
            setMarkdownInputState(view, {
              composing: false,
              forceCheck: true,
              suppressUntil: 0,
            });
          }, IME_SETTLE_DELAY_MS);
          return false;
        },
      },

      decorations(state) {
        return buildPendingHeadingDecorations(state.doc);
      },
    },

    appendTransaction(transactions, _oldState, newState) {
      const pluginState = markdownInputPluginKey.getState(newState);
      if (pluginState?.composing) return null;
      if (pluginState && pluginState.suppressUntil > Date.now()) return null;

      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged && !pluginState?.forceCheck) return null;

      // 1. 空 heading 被删空 → 退回 pending heading（恢复 `# ` 前缀）。
      if (docChanged) {
        const revert = revertEmptyHeading(newState.tr, newState.doc);
        if (revert) return revert;
      }

      // 2. pending heading → 真正 heading：仅在 settle 之后（forceCheck）转换，
      //    避免连续输入时频繁转换、以及空 heading 上的 IME 错位。
      if (pluginState?.forceCheck) {
        const heading = convertPendingHeading(
          newState.tr,
          newState.doc,
          newState.schema.nodes.heading,
        );
        if (heading) return heading;
      }

      // 3. 行内标记：非 composition 文档变更即转换（即时），forceCheck 收尾兜底。
      const marks = convertPendingInlineMarks(newState.tr, newState);
      if (marks) return marks;

      return null;
    },
  });
}

function setMarkdownInputState(view: EditorView, state: Partial<MarkdownInputState>) {
  view.dispatch(view.state.tr.setMeta(markdownInputPluginKey, state));
}

// ── 行内标记转换 ──────────────────────────────────────────────

function matchInlineSyntax(
  textBeforeCursor: string,
  markType: MarkType,
  finder: Matcher,
): InlineMatch | null {
  if (typeof finder === 'function') {
    const result = finder(textBeforeCursor);
    if (!result) return null;

    const innerText = result.replaceWith ?? result.text;
    if (!innerText) return null;

    return {
      markType,
      fullStart: result.index,
      fullEnd: result.index + result.text.length,
      openingStart: result.index,
      innerStart: result.index + result.text.indexOf(innerText),
      innerText,
    };
  }

  const result = finder.exec(textBeforeCursor);
  if (!result) return null;

  const innerText = result[result.length - 1];
  if (!innerText) return null;

  const fullStart = result.index ?? textBeforeCursor.length - result[0].length;
  const fullMatch = result[0];
  const leadingOffset = fullMatch.search(/\S/);

  return {
    markType,
    fullStart,
    fullEnd: fullStart + fullMatch.length,
    openingStart: fullStart + Math.max(0, leadingOffset),
    innerStart: fullStart + fullMatch.lastIndexOf(innerText),
    innerText,
  };
}

function findPendingInlineMark(state: EditorState): InlineMatch | null {
  const { selection, schema } = state;
  const { $cursor } = selection as TextSelection;
  if (!$cursor) return null;

  const parent = $cursor.parent;
  if (!parent.isTextblock || parent.type.spec.code) return null;

  const textBeforeCursor = parent.textBetween(0, $cursor.parentOffset, undefined, '￼');
  if (!textBeforeCursor) return null;

  for (const candidate of inlineMarkCandidates) {
    const markType = schema.marks[candidate.name];
    if (!markType) continue;

    const match = matchInlineSyntax(textBeforeCursor, markType, candidate.finder);
    if (match) return match;
  }

  return null;
}

export function convertPendingInlineMarks(
  tr: Transaction,
  state: EditorState,
): Transaction | null {
  const { selection } = state;
  const { $cursor } = selection as TextSelection;
  if (!$cursor) return null;

  const match = findPendingInlineMark(state);
  if (!match) return null;

  const parentStart = $cursor.start();
  const openingStart = parentStart + match.openingStart;
  const innerStart = parentStart + match.innerStart;
  const innerEnd = innerStart + match.innerText.length;
  const closingEnd = parentStart + match.fullEnd;

  if (match.innerText.length === 0) return null;
  if (openingStart > innerStart || innerEnd > closingEnd) return null;

  tr.delete(innerEnd, closingEnd);
  tr.delete(openingStart, innerStart);
  tr.addMark(openingStart, openingStart + match.innerText.length, match.markType.create());
  tr.removeStoredMark(match.markType);

  return tr.steps.length ? tr : null;
}

// ── 标题（pending heading）转换 ────────────────────────────────

function findPendingHeading(doc: PMNode): PendingHeading | null {
  let pending: PendingHeading | null = null;

  doc.descendants((node, pos) => {
    if (pending || node.type.name !== 'paragraph') return false;

    const match = /^(#{1,6})\s\S/.exec(node.textContent);
    if (!match) return false;

    pending = {
      level: match[1].length,
      paragraphPos: pos,
      prefixLength: match[1].length + 1,
    };

    return false;
  });

  return pending;
}

/**
 * 空 heading 被删空时，转回 paragraph 并恢复 `# ` 前缀，让 pending 机制重新接管，
 * 规避空 heading 上的 IME composition 错位。
 */
export function revertEmptyHeading(tr: Transaction, doc: PMNode): Transaction | null {
  let result: Transaction | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name !== 'heading') return true;
    if (node.content.size > 0) return true;

    const level = node.attrs.level as number;
    if (!HEADING_LEVELS.includes(level as (typeof HEADING_LEVELS)[number])) return true;

    const prefix = '#'.repeat(level) + ' ';
    const paragraphType = doc.type.schema.nodes.paragraph;
    if (!paragraphType) return true;

    tr.setBlockType(pos, pos + node.nodeSize, paragraphType);
    tr.insertText(prefix, pos + 1);

    result = tr.docChanged ? tr : null;
    return false;
  });

  return result;
}

export function convertPendingHeading(
  tr: Transaction,
  doc: PMNode,
  headingType: NodeType | undefined,
): Transaction | null {
  if (!headingType) return null;

  const pending = findPendingHeading(doc);
  if (
    !pending ||
    !HEADING_LEVELS.includes(pending.level as (typeof HEADING_LEVELS)[number])
  ) {
    return null;
  }

  const contentPos = pending.paragraphPos + 1;

  tr.delete(contentPos, contentPos + pending.prefixLength);
  tr.setBlockType(contentPos, contentPos, headingType, { level: pending.level });

  return tr.docChanged ? tr : null;
}

function buildPendingHeadingDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return true;

    const match = /^(#{1,6})\s/.exec(node.textContent);
    if (!match) return false;

    const level = match[1].length;
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: `mk-pending-heading mk-pending-heading-${level}`,
        'data-pending-heading-level': `H${level}`,
      }),
    );
    decorations.push(
      Decoration.inline(pos + 1, pos + 1 + match[0].length, {
        class: 'mk-pending-heading-prefix',
      }),
    );

    return false;
  });

  return DecorationSet.create(doc, decorations);
}
