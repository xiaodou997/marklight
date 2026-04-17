/**
 * 行内 Mark Token 实体化（方案 C Phase A/B/C）
 *
 * 将 Markdown 行内语法符号升格为真实 PM 节点，取代 inline-deco.ts 的 Decoration widget。
 * Mark 仍作为样式载体（真理源），Token 节点由 plugin 派生维护。
 *
 * 不变量：每个 mark run 的首尾必须有配对 token 节点。
 */
import { Node, Extension } from '@tiptap/vue-3';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode, NodeType, MarkType } from '@tiptap/pm/model';

// ── Token 配置表 ─────────────────────────────────────────────

interface TokenConfig {
  markName: string;
  openName: string;
  closeName: string;
  syntax: string; // 渲染文本（如 "**"）
  cssClass: string;
}

const PHASE_A_TOKENS: TokenConfig[] = [
  { markName: 'bold', openName: 'boldOpen', closeName: 'boldClose', syntax: '**', cssClass: 'mk-tok-bold' },
  { markName: 'italic', openName: 'italicOpen', closeName: 'italicClose', syntax: '*', cssClass: 'mk-tok-italic' },
  { markName: 'strike', openName: 'strikeOpen', closeName: 'strikeClose', syntax: '~~', cssClass: 'mk-tok-strike' },
];

// Phase B/C 后续追加到此数组
const ALL_TOKENS: TokenConfig[] = [...PHASE_A_TOKENS];

// 用于快速查找的集合
export const TOKEN_NODE_NAMES = new Set<string>();
ALL_TOKENS.forEach((t) => {
  TOKEN_NODE_NAMES.add(t.openName);
  TOKEN_NODE_NAMES.add(t.closeName);
});

// ── Token 节点工厂 ───────────────────────────────────────────

function createTokenNode(name: string, syntax: string, cssClass: string) {
  return Node.create({
    name,
    inline: true,
    group: 'inline',
    atom: true,
    selectable: false,

    parseHTML() {
      return [{ tag: `span[data-mark-token="${name}"]` }];
    },

    renderHTML() {
      return [
        'span',
        {
          'data-mark-token': name,
          class: `mk-tok ${cssClass}`,
          contenteditable: 'false',
        },
        syntax,
      ];
    },
  });
}

// ── 导出所有 Token 节点 ──────────────────────────────────────

export const BoldOpen = createTokenNode('boldOpen', '**', 'mk-tok-bold');
export const BoldClose = createTokenNode('boldClose', '**', 'mk-tok-bold');
export const ItalicOpen = createTokenNode('italicOpen', '*', 'mk-tok-italic');
export const ItalicClose = createTokenNode('italicClose', '*', 'mk-tok-italic');
export const StrikeOpen = createTokenNode('strikeOpen', '~~', 'mk-tok-strike');
export const StrikeClose = createTokenNode('strikeClose', '~~', 'mk-tok-strike');

// ── markTokenSync Plugin ─────────────────────────────────────

const markTokenSyncKey = new PluginKey('markTokenSync');

interface MarkRun {
  markName: string;
  from: number; // 绝对位置：mark run 首字符
  to: number;   // 绝对位置：mark run 末字符之后
}

/**
 * 在一个 textblock 内收集所有 mark run
 * 返回按 from 升序排列的 run 数组
 */
function collectMarkRuns(
  block: PMNode,
  blockStart: number,
  syncedMarks: string[],
): MarkRun[] {
  const runs: MarkRun[] = [];

  for (const markName of syncedMarks) {
    let runFrom = -1;

    block.forEach((child, offset) => {
      const absPos = blockStart + offset;
      const hasMark = child.isText && child.marks.some((m) => m.type.name === markName);

      if (hasMark) {
        if (runFrom === -1) runFrom = absPos;
      } else {
        if (runFrom !== -1) {
          runs.push({ markName, from: runFrom, to: absPos });
          runFrom = -1;
        }
      }
    });

    // run 延伸到 block 末尾
    if (runFrom !== -1) {
      runs.push({ markName, from: runFrom, to: blockStart + block.content.size });
    }
  }

  runs.sort((a, b) => a.from - b.from || a.to - b.to);
  return runs;
}

/**
 * 检查位置 pos 处是否有指定类型的 token 节点
 */
function hasTokenAt(doc: PMNode, pos: number, tokenTypeName: string): boolean {
  if (pos < 0 || pos >= doc.content.size) return false;
  try {
    const node = doc.nodeAt(pos);
    return node?.type.name === tokenTypeName;
  } catch {
    return false;
  }
}

type Action =
  | { kind: 'insert'; pos: number; tokenName: string }
  | { kind: 'delete'; from: number; to: number };

function buildMarkTokenSyncPlugin(): Plugin {
  const syncedMarkNames = ALL_TOKENS.map((t) => t.markName);
  const markToOpen = new Map<string, string>();
  const markToClose = new Map<string, string>();
  ALL_TOKENS.forEach((t) => {
    markToOpen.set(t.markName, t.openName);
    markToClose.set(t.markName, t.closeName);
  });

  return new Plugin({
    key: markTokenSyncKey,

    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
        const { state } = view;
        const { selection } = state;
        if (!selection.empty) return false;

        const { $from } = selection;
        const parent = $from.parent;
        if (!parent.isTextblock) return false;

        const parentStart = $from.start($from.depth);
        const offset = $from.parentOffset;

        if (event.key === 'Backspace' && offset > 0) {
          // 光标左侧是否是某个 token？
          const leftNode = parent.nodeAt(offset - 1);
          if (!leftNode || !TOKEN_NODE_NAMES.has(leftNode.type.name)) return false;

          // 找到配对的另一端 token 并删除 + 剥离 mark
          const tokenName = leftNode.type.name;
          const config = ALL_TOKENS.find(
            (t) => t.openName === tokenName || t.closeName === tokenName,
          );
          if (!config) return false;

          const isOpen = tokenName === config.openName;
          const pairName = isOpen ? config.closeName : config.openName;
          const markType = state.schema.marks[config.markName] as MarkType | undefined;
          if (!markType) return false;

          // 在 parent 中搜索配对 token
          const tr = state.tr;
          const deletePositions: number[] = [];
          deletePositions.push(parentStart + offset - 1); // 当前 token

          // 扫描 parent 找配对
          parent.forEach((child, childOffset) => {
            if (child.type.name === pairName) {
              const absPos = parentStart + childOffset;
              // 对于 open token 被删：找到 close token（在其后面）
              // 对于 close token 被删：找到 open token（在其前面）
              if (isOpen && absPos > parentStart + offset - 1) {
                deletePositions.push(absPos);
              } else if (!isOpen && absPos < parentStart + offset - 1) {
                deletePositions.push(absPos);
              }
            }
          });

          // 找到最近的配对（open 的话找最近的 close）
          if (deletePositions.length < 2) {
            // 孤儿 token，只删当前
            tr.delete(parentStart + offset - 1, parentStart + offset);
            view.dispatch(tr);
            return true;
          }

          // 计算 mark run 范围并剥离 mark
          const sorted = deletePositions.sort((a, b) => a - b);
          const runFrom = sorted[0] + 1; // open token 后
          const runTo = sorted[sorted.length - 1]; // close token 前

          // 反向删除 token（从后往前避免位置漂移）
          for (let i = sorted.length - 1; i >= 0; i--) {
            tr.delete(sorted[i], sorted[i] + 1);
          }

          // 剥离 mark（位置已因删除而偏移，通过 mapping 计算）
          const mappedFrom = tr.mapping.map(runFrom);
          const mappedTo = tr.mapping.map(runTo);
          if (mappedFrom < mappedTo) {
            tr.removeMark(mappedFrom, mappedTo, markType);
          }

          view.dispatch(tr);
          return true;
        }

        return false;
      },
    },

    appendTransaction(_trs, _oldState, newState) {
      const tokenTypes: Record<string, NodeType> = {};
      for (const t of ALL_TOKENS) {
        const openType = newState.schema.nodes[t.openName];
        const closeType = newState.schema.nodes[t.closeName];
        if (openType && closeType) {
          tokenTypes[t.openName] = openType;
          tokenTypes[t.closeName] = closeType;
        }
      }

      const actions: Action[] = [];

      newState.doc.descendants((node, pos) => {
        if (!node.isTextblock) return;

        const blockStart = pos + 1; // 文本内容起始位置
        const runs = collectMarkRuns(node, blockStart, syncedMarkNames);

        // 检查每个 run 是否有配对 token
        for (const run of runs) {
          const openTokenName = markToOpen.get(run.markName)!;
          const closeTokenName = markToClose.get(run.markName)!;

          // 检查 open token：应在 run.from 之前
          const openPos = run.from - 1;
          if (!hasTokenAt(newState.doc, openPos, openTokenName)) {
            // 确保不会在 blockStart 之前插入
            if (run.from >= blockStart) {
              actions.push({ kind: 'insert', pos: run.from, tokenName: openTokenName });
            }
          }

          // 检查 close token：应在 run.to 处
          if (!hasTokenAt(newState.doc, run.to, closeTokenName)) {
            actions.push({ kind: 'insert', pos: run.to, tokenName: closeTokenName });
          }
        }

        // 检查孤儿 token（没有对应 mark run 的 token）
        node.forEach((child, childOffset) => {
          if (!TOKEN_NODE_NAMES.has(child.type.name)) return;

          const absPos = blockStart + childOffset;
          const config = ALL_TOKENS.find(
            (t) => t.openName === child.type.name || t.closeName === child.type.name,
          );
          if (!config) return;

          const isOpen = child.type.name === config.openName;
          // 验证是否紧邻一个对应 mark run
          const adjacentPos = isOpen ? absPos + 1 : absPos - 1;
          let hasAdjacentRun = false;
          try {
            const adjacentNode = newState.doc.nodeAt(adjacentPos);
            if (adjacentNode?.isText && adjacentNode.marks.some((m) => m.type.name === config.markName)) {
              hasAdjacentRun = true;
            }
          } catch { /* out of bounds */ }

          // 对于 closeToken，也检查左侧
          if (!isOpen) {
            try {
              const leftNode = newState.doc.nodeAt(absPos - 1);
              if (leftNode?.isText && leftNode.marks.some((m) => m.type.name === config.markName)) {
                hasAdjacentRun = true;
              }
            } catch { /* out of bounds */ }
          }

          if (!hasAdjacentRun) {
            actions.push({ kind: 'delete', from: absPos, to: absPos + child.nodeSize });
          }
        });

        return false; // 不递归到子节点
      });

      if (actions.length === 0) return null;

      const tr = newState.tr;

      // 去重：避免在同一位置重复插入
      const insertSet = new Set<string>();
      const dedupedActions = actions.filter((a) => {
        if (a.kind === 'insert') {
          const key = `${a.pos}:${a.tokenName}`;
          if (insertSet.has(key)) return false;
          insertSet.add(key);
        }
        return true;
      });

      // 按位置降序排列（先处理后面的，避免位置漂移）
      dedupedActions.sort((a, b) => {
        const posA = a.kind === 'insert' ? a.pos : a.from;
        const posB = b.kind === 'insert' ? b.pos : b.from;
        return posB - posA;
      });

      for (const action of dedupedActions) {
        if (action.kind === 'insert') {
          const nodeType = tokenTypes[action.tokenName];
          if (nodeType) {
            tr.insert(action.pos, nodeType.create());
          }
        } else {
          tr.delete(action.from, action.to);
        }
      }

      return tr;
    },
  });
}

// ── TipTap 扩展入口 ─────────────────────────────────────────

export const MarkTokenSync = Extension.create({
  name: 'markTokenSync',

  addProseMirrorPlugins() {
    return [buildMarkTokenSyncPlugin()];
  },
});
