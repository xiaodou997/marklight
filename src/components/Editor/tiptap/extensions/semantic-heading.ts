/**
 * SemanticHeading 扩展
 *
 * 使用 "pending heading" 延迟转换策略：输入 `# ` 后段落保持为 paragraph，
 * 通过 CSS 装饰模拟标题外观，等用户继续输入内容后再转换为真正的 heading 节点。
 *
 * 这样做的原因：
 * - 如果 `# ` 后立即转换（textblockTypeInputRule），PM 文档变成空 heading，
 *   但 DOM 更新是异步的。当用户紧接着开始 IME composition 时，
 *   ProseMirror 的 compositionstart handler 会 forceFlush DOM observer，
 *   此时 DOM 和 PM 文档不同步，导致 readDOMChange 产生错误的 transaction，
 *   把中文候选词拆到下一段。
 * - pending heading 方案下，paragraph 保留了 `# ` 文本，IME 的拼音追加在
 *   `# ` 后面，DOM 和 PM 文档始终一致，readDOMChange 不会出错。
 *
 * 光标可见性修复：
 * - 之前的 pending heading 方案用 `font-size: 0; color: transparent` 隐藏 `# ` 前缀，
 *   导致光标在零宽度位置不可见。
 * - 现在改用淡化的小号前缀显示，既保留文本宽度和光标位置，也不会让 IME 拼音变透明。
 */
import { Heading } from '@tiptap/extension-heading';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode, NodeType } from '@tiptap/pm/model';

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const IME_SETTLE_DELAY_MS = 50;
const TEXT_SETTLE_DELAY_MS = 300;
const pendingHeadingPluginKey = new PluginKey<PendingHeadingState>('pendingHeading');

type PendingHeadingState = {
  composing: boolean;
  forceCheck: boolean;
  suppressUntil: number;
};

type PendingHeading = {
  level: number;
  paragraphPos: number;
  prefixLength: number;
};

export const SemanticHeading = Heading.extend({
  addInputRules() {
    return [];
  },

  addProseMirrorPlugins() {
    return [pendingHeadingPlugin()];
  },
});

function pendingHeadingPlugin(): Plugin<PendingHeadingState> {
  return new Plugin<PendingHeadingState>({
    key: pendingHeadingPluginKey,

    state: {
      init() {
        return {
          composing: false,
          forceCheck: false,
          suppressUntil: 0,
        };
      },
      apply(tr, value) {
        const meta = tr.getMeta(pendingHeadingPluginKey) as
          | Partial<PendingHeadingState>
          | undefined;
        if (!meta) {
          return {
            ...value,
            forceCheck: false,
          };
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
          setPendingHeadingConversionState(view, {
            composing: false,
            forceCheck: true,
            suppressUntil: 0,
          });
        }, delay);
      }

      return {
        update(view, previousState) {
          if (view.state.doc.eq(previousState.doc)) return;

          const pluginState = pendingHeadingPluginKey.getState(view.state);
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
          setPendingHeadingConversionState(view, {
            composing: true,
            forceCheck: false,
            suppressUntil: Number.POSITIVE_INFINITY,
          });
          return false;
        },
        compositionend(view) {
          const suppressUntil = Date.now() + IME_SETTLE_DELAY_MS;
          setPendingHeadingConversionState(view, {
            composing: false,
            forceCheck: false,
            suppressUntil,
          });
          window.setTimeout(() => {
            setPendingHeadingConversionState(view, {
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
      const pluginState = pendingHeadingPluginKey.getState(newState);
      if (pluginState?.composing) return null;
      if (pluginState && pluginState.suppressUntil > Date.now()) return null;

      const docChanged = transactions.some((tr) => tr.docChanged);

      // ── 空 heading 退回 pending heading ──
      // 当 heading 内容被 Backspace 删空时，把它转回 paragraph 并恢复 `# ` 前缀。
      // 这样 pending heading 机制重新接管，避免空 heading 上的 IME composition 错位问题。
      if (docChanged) {
        const revert = revertEmptyHeading(newState.tr, newState.doc);
        if (revert) return revert;
      }

      // ── pending heading → 真正 heading 转换 ──

      // 允许 forceCheck 触发转换，无论 docChanged 与否
      // 之前 !docChanged 条件导致 composition 结束后转换永远无法触发
      if (pluginState?.forceCheck) {
        return convertPendingHeading(
          newState.tr,
          newState.doc,
          newState.schema.nodes.heading,
        );
      }

      // 当有文档变化且不在 composition/suppress 期间，也检查是否有 pending heading
      // 这确保了用户在 `# ` 后输入非 IME 文本时也能正常转换
      if (
        docChanged &&
        !pluginState?.composing &&
        (!pluginState || pluginState.suppressUntil <= Date.now())
      ) {
        const result = convertPendingHeading(
          newState.tr,
          newState.doc,
          newState.schema.nodes.heading,
        );
        if (result) return result;
      }

      return null;
    },
  });
}

function setPendingHeadingConversionState(
  view: EditorView,
  state: Partial<PendingHeadingState>,
): void {
  const tr = view.state.tr.setMeta(pendingHeadingPluginKey, state);
  view.dispatch(tr);
}

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
 * 当 heading 内容被删除变空时，把它转回 paragraph 并恢复 `# ` 前缀。
 *
 * 场景：用户输入 `# 张三` → heading 节点 → Backspace 删完 → 空 heading。
 * 空 heading 上的 IME composition 会导致中文错位（与 # + 空格后立即转换的问题相同）。
 * 转回 pending heading（paragraph + `# ` 前缀）后，IME 输入正常工作。
 */
export function revertEmptyHeading(
  tr: Transaction,
  doc: PMNode,
): Transaction | null {
  let result: Transaction | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name !== 'heading') return true;

    // 只处理空的 heading（没有文本内容）
    if (node.content.size > 0) return true;

    const level = node.attrs.level as number;
    if (!HEADING_LEVELS.includes(level as (typeof HEADING_LEVELS)[number])) return true;

    // 把空 heading 转回 paragraph，并插入 `# ` 前缀
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
