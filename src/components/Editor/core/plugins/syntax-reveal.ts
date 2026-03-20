/**
 * syntax-reveal 插件 — 行级源码模式
 *
 * 光标进入某行时，将该行内容拍平为 Markdown 源码文本（真实可编辑文本）。
 * 光标离开时，解析回结构化内容（marks + 节点类型）。
 *
 * 核心原理：
 * 1. 进入：buildParagraphMap → 获取源码文本 → 替换节点内容为纯文本
 * 2. 离开：解析纯文本 → parseInlineNodes → 恢复 marks + 更新节点类型
 * 3. 进出使用 addToHistory: false → 不污染 undo
 */
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import { EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { Slice } from 'prosemirror-model';
import { liftListItem } from 'prosemirror-schema-list';

// markDelimiters 保留备用
// import { markDelimiters } from '../utils/marks';
import { buildParagraphMap, parseInlineNodes } from '../utils/paragraph-mapping';
import { mySchema } from '../schema';

// ─── 类型 ───

interface ActiveLine {
  /** 行内容器节点在文档中的位置（heading/paragraph/task_item 的 nodePos） */
  nodePos: number;
  /** 原始节点类型名 */
  nodeType: string;
  /** 原始节点属性 */
  nodeAttrs: Record<string, unknown>;
  /** 文本内容起始位置（nodePos + 1） */
  textStart: number;
  /** 块前缀长度 */
  prefixLen: number;
  /** 块前缀文本 */
  prefix: string;
  /** 对于列表项，记录外层结构信息 */
  listInfo?: {
    listItemPos: number;
    listItemType: string; // 'list_item' | 'task_item'
  };
  /** 对于引用块，记录 blockquote 位置 */
  blockquotePos?: number;
}

interface SourceLineState {
  activeLine: ActiveLine | null;
}

// ─── PluginKey ───

export const syntaxRevealKey = new PluginKey<SourceLineState>('syntax-reveal');

// ─── 辅助函数 ───

/**
 * 找到光标所在的行内容器节点及其上下文信息
 * 返回 nodePos, node, 以及块前缀信息
 */
function findCursorLine(state: EditorState): {
  nodePos: number;
  node: PMNode;
  textStart: number;
  prefix: string;
  listInfo?: { listItemPos: number; listItemType: string };
  blockquotePos?: number;
} | null {
  const { $from } = state.selection;
  if (!$from) return null;

  const parent = $from.parent;
  const inlineContainers = ['paragraph', 'heading', 'task_item'];
  if (!inlineContainers.includes(parent.type.name)) return null;

  const nodePos = $from.before($from.depth);
  const textStart = $from.start($from.depth);

  let prefix = '';
  let listInfo: { listItemPos: number; listItemType: string } | undefined;
  let blockquotePos: number | undefined;

  if (parent.type.name === 'heading') {
    const level = parent.attrs.level || 1;
    prefix = '#'.repeat(level) + ' ';
  } else if (parent.type.name === 'task_item') {
    const checked = Boolean(parent.attrs.checked);
    prefix = `- [${checked ? 'x' : ' '}] `;
    listInfo = { listItemPos: nodePos, listItemType: 'task_item' };
  } else {
    // paragraph — 检查是否在列表或引用中
    for (let d = $from.depth - 1; d > 0; d--) {
      const ancestor = $from.node(d);
      if (ancestor.type.name === 'list_item') {
        const listNode = $from.node(d - 1);
        if (listNode?.type?.name === 'ordered_list') {
          const base = Number(listNode.attrs?.order || 1);
          const index = $from.index(d - 1);
          const order = base + index;
          const delimiter = listNode.attrs?.delimiter || '.';
          prefix = `${order}${delimiter} `;
        } else {
          const marker = listNode?.attrs?.marker || '-';
          prefix = `${marker} `;
        }
        listInfo = { listItemPos: $from.before(d), listItemType: 'list_item' };
        break;
      }
      if (ancestor.type.name === 'blockquote') {
        // 只对引用内的第一个段落加前缀
        if ($from.index(d) === 0) {
          prefix = '> ';
          blockquotePos = $from.before(d);
        }
        break;
      }
    }
  }

  return { nodePos, node: parent, textStart, prefix, listInfo, blockquotePos };
}

/**
 * 进入源码模式：将行内容拍平为 Markdown 源码文本
 */
function enterSourceMode(
  state: EditorState,
  lineInfo: NonNullable<ReturnType<typeof findCursorLine>>,
): Transaction | null {
  const { nodePos, node, textStart, prefix, listInfo, blockquotePos } = lineInfo;

  // 计算源码文本
  const { source, pmToSrcAO } = buildParagraphMap(node);
  const fullSource = prefix + source;

  if (fullSource.length === 0 && node.content.size === 0) {
    // 空行不需要进入源码模式（除非有前缀）
    if (!prefix) return null;
  }

  // 映射当前光标位置到源码偏移
  const parentOffset = state.selection.$from.parentOffset;
  const srcOffset = parentOffset <= node.content.size
    ? pmToSrcAO[parentOffset] ?? parentOffset
    : source.length;
  const cursorInSource = textStart + prefix.length + srcOffset;

  // 构建 transaction
  const tr = state.tr;
  tr.setMeta('addToHistory', false);

  // 替换节点内容为纯文本
  const contentFrom = textStart;
  const contentTo = textStart + node.content.size;

  if (fullSource.length > 0) {
    const textNode = mySchema.text(fullSource);
    tr.replaceWith(contentFrom, contentTo, textNode);
  } else {
    tr.delete(contentFrom, contentTo);
  }

  // 设置光标
  const mappedCursor = Math.min(cursorInSource, tr.doc.resolve(textStart).end());
  try {
    tr.setSelection(TextSelection.create(tr.doc, mappedCursor));
  } catch {
    // 如果位置无效，放到文本开头
    try {
      tr.setSelection(TextSelection.create(tr.doc, textStart));
    } catch { /* ignore */ }
  }

  // 设置插件状态
  tr.setMeta(syntaxRevealKey, {
    activeLine: {
      nodePos,
      nodeType: node.type.name,
      nodeAttrs: { ...node.attrs },
      textStart,
      prefixLen: prefix.length,
      prefix,
      listInfo,
      blockquotePos,
    },
  } as SourceLineState);

  return tr;
}

/**
 * 退出源码模式：解析源码文本，恢复结构化内容
 */
function exitSourceMode(
  state: EditorState,
  active: ActiveLine,
): Transaction | null {
  // 找到当前源码模式行的节点
  let node: PMNode | null = null;
  try {
    node = state.doc.nodeAt(active.nodePos);
  } catch {
    return null;
  }
  if (!node) return null;

  // 验证节点仍然是内容节点
  const textStart = active.nodePos + 1;
  const plainText = node.textContent;

  // 解析块前缀，确定新的节点类型
  const parsed = parseBlockPrefix(plainText);
  const inlineSource = plainText.slice(parsed.prefixLen);

  // 解析行内内容
  const newNodes = parseInlineNodes(inlineSource, mySchema);

  const tr = state.tr;
  tr.setMeta('addToHistory', false);

  // 替换内容
  const contentFrom = textStart;
  const contentTo = textStart + node.content.size;

  if (newNodes.length > 0) {
    tr.replaceWith(contentFrom, contentTo, newNodes as PMNode[]);
  } else if (node.content.size > 0) {
    tr.delete(contentFrom, contentTo);
  }

  // 处理节点类型变更
  applyBlockTypeChange(tr, active, parsed);

  tr.setMeta(syntaxRevealKey, { activeLine: null } as SourceLineState);

  return tr;
}

/**
 * 退出旧行 + 进入新行 合并为单个 transaction
 *
 * ProseMirror 的 appendTransaction 使用 seen 缓存：在一次 applyTransaction 周期中，
 * 每个插件的 appendTransaction 只被调用一次，后续循环使用缓存结果。
 * 因此，如果分两步（先退出再进入），退出占用了唯一的调用机会，进入永远不会发生。
 * 解决方案：在同一个 transaction 中完成退出和进入两步操作。
 */
function exitAndEnterSourceMode(
  state: EditorState,
  active: ActiveLine,
  newLineInfo: NonNullable<ReturnType<typeof findCursorLine>>,
): Transaction | null {
  // ── Step 1: 退出旧行 ──
  let oldNode: PMNode | null = null;
  try {
    oldNode = state.doc.nodeAt(active.nodePos);
  } catch {
    // 位置无效，跳过退出，直接进入
    return enterSourceMode(state, newLineInfo);
  }
  if (!oldNode) {
    return enterSourceMode(state, newLineInfo);
  }

  const oldTextStart = active.nodePos + 1;
  const oldPlainText = oldNode.textContent;
  const oldParsed = parseBlockPrefix(oldPlainText);
  const oldInlineSource = oldPlainText.slice(oldParsed.prefixLen);
  const oldNewNodes = parseInlineNodes(oldInlineSource, mySchema);

  const tr = state.tr;
  tr.setMeta('addToHistory', false);

  // 替换旧行内容（从源码文本恢复为带 marks 的结构化内容）
  const oldContentFrom = oldTextStart;
  const oldContentTo = oldTextStart + oldNode.content.size;

  if (oldNewNodes.length > 0) {
    tr.replaceWith(oldContentFrom, oldContentTo, oldNewNodes as PMNode[]);
  } else if (oldNode.content.size > 0) {
    tr.delete(oldContentFrom, oldContentTo);
  }

  // 处理旧行节点类型变更
  applyBlockTypeChange(tr, active, oldParsed);

  // ── Step 2: 映射新行位置，进入新行 ──
  // 退出旧行后文档发生了变化，新行的位置需要通过 mapping 重新计算
  const mappedNodePos = tr.mapping.map(newLineInfo.nodePos);

  let newNode: PMNode | null = null;
  try {
    newNode = tr.doc.nodeAt(mappedNodePos);
  } catch {
    // 映射后位置无效
    tr.setMeta(syntaxRevealKey, { activeLine: null } as SourceLineState);
    return tr;
  }
  if (!newNode) {
    tr.setMeta(syntaxRevealKey, { activeLine: null } as SourceLineState);
    return tr;
  }

  // 验证映射后的节点仍然是行内容器
  const inlineContainers = ['paragraph', 'heading', 'task_item'];
  if (!inlineContainers.includes(newNode.type.name)) {
    tr.setMeta(syntaxRevealKey, { activeLine: null } as SourceLineState);
    return tr;
  }

  const newTextStart = mappedNodePos + 1;

  // 重新计算新行的前缀（使用映射后的节点属性）
  let newPrefix = newLineInfo.prefix;
  if (newNode.type.name === 'heading') {
    const level = newNode.attrs.level || 1;
    newPrefix = '#'.repeat(level) + ' ';
  } else if (newNode.type.name === 'task_item') {
    const checked = Boolean(newNode.attrs.checked);
    newPrefix = `- [${checked ? 'x' : ' '}] `;
  }

  // 计算新行的源码文本
  const { source: newSource, pmToSrcAO: newPmToSrcAO } = buildParagraphMap(newNode);
  const newFullSource = newPrefix + newSource;

  if (newFullSource.length === 0 && newNode.content.size === 0 && !newPrefix) {
    tr.setMeta(syntaxRevealKey, { activeLine: null } as SourceLineState);
    return tr;
  }

  // 映射光标位置到新行的源码偏移
  // 原始光标在 state.selection 中，映射到新文档中
  const mappedCursorPos = tr.mapping.map(state.selection.$from.pos);
  let newParentOffset = 0;
  try {
    const $mapped = tr.doc.resolve(mappedCursorPos);
    if ($mapped.parent === newNode || $mapped.before($mapped.depth) === mappedNodePos) {
      newParentOffset = $mapped.parentOffset;
    }
  } catch { /* ignore */ }

  const newSrcOffset = newParentOffset <= newNode.content.size
    ? newPmToSrcAO[newParentOffset] ?? newParentOffset
    : newSource.length;
  const newCursorInSource = newTextStart + newPrefix.length + newSrcOffset;

  // 替换新行内容为纯文本
  const newContentFrom = newTextStart;
  const newContentTo = newTextStart + newNode.content.size;

  if (newFullSource.length > 0) {
    const textNode = mySchema.text(newFullSource);
    tr.replaceWith(newContentFrom, newContentTo, textNode);
  } else {
    tr.delete(newContentFrom, newContentTo);
  }

  // 设置光标
  const newMappedCursor = Math.min(newCursorInSource, tr.doc.resolve(newTextStart).end());
  try {
    tr.setSelection(TextSelection.create(tr.doc, newMappedCursor));
  } catch {
    try {
      tr.setSelection(TextSelection.create(tr.doc, newTextStart));
    } catch { /* ignore */ }
  }

  // 设置插件状态为新行的 activeLine
  const mappedListInfo = newLineInfo.listInfo
    ? {
        listItemPos: tr.mapping.map(newLineInfo.listInfo.listItemPos),
        listItemType: newLineInfo.listInfo.listItemType,
      }
    : undefined;
  const mappedBlockquotePos = newLineInfo.blockquotePos !== undefined
    ? tr.mapping.map(newLineInfo.blockquotePos)
    : undefined;

  tr.setMeta(syntaxRevealKey, {
    activeLine: {
      nodePos: mappedNodePos,
      nodeType: newNode.type.name,
      nodeAttrs: { ...newNode.attrs },
      textStart: newTextStart,
      prefixLen: newPrefix.length,
      prefix: newPrefix,
      listInfo: mappedListInfo,
      blockquotePos: mappedBlockquotePos,
    },
  } as SourceLineState);

  return tr;
}

/**
 * 解析纯文本开头的块前缀
 */
interface ParsedPrefix {
  kind: 'heading' | 'blockquote' | 'bullet' | 'ordered' | 'task' | 'none';
  prefixLen: number;
  level: number;
  order: number;
  delimiter: string;
  marker: string;
  checked: boolean;
}

function parseBlockPrefix(text: string): ParsedPrefix {
  // 标题
  const headingMatch = text.match(/^(#{1,6})\s/);
  if (headingMatch) {
    return {
      kind: 'heading',
      prefixLen: headingMatch[0].length,
      level: headingMatch[1].length,
      order: 1,
      delimiter: '.',
      marker: '-',
      checked: false,
    };
  }

  // 任务项
  const taskMatch = text.match(/^[-*+]\s\[([ xX])\]\s/);
  if (taskMatch) {
    return {
      kind: 'task',
      prefixLen: taskMatch[0].length,
      level: 0,
      order: 1,
      delimiter: '.',
      marker: '-',
      checked: taskMatch[1].toLowerCase() === 'x',
    };
  }

  // 引用
  const bqMatch = text.match(/^>\s/);
  if (bqMatch) {
    return {
      kind: 'blockquote',
      prefixLen: bqMatch[0].length,
      level: 0,
      order: 1,
      delimiter: '.',
      marker: '-',
      checked: false,
    };
  }

  // 有序列表
  const olMatch = text.match(/^(\d+)([.)]) /);
  if (olMatch) {
    return {
      kind: 'ordered',
      prefixLen: olMatch[0].length,
      level: 0,
      order: Number(olMatch[1]) || 1,
      delimiter: olMatch[2],
      marker: '-',
      checked: false,
    };
  }

  // 无序列表
  const ulMatch = text.match(/^([-*+])\s/);
  if (ulMatch) {
    return {
      kind: 'bullet',
      prefixLen: ulMatch[0].length,
      level: 0,
      order: 1,
      delimiter: '.',
      marker: ulMatch[1],
      checked: false,
    };
  }

  return {
    kind: 'none',
    prefixLen: 0,
    level: 0,
    order: 1,
    delimiter: '.',
    marker: '-',
    checked: false,
  };
}

/**
 * 根据前缀解析结果，更新节点类型
 */
function applyBlockTypeChange(
  tr: Transaction,
  active: ActiveLine,
  parsed: ParsedPrefix,
) {
  const nodePos = active.nodePos;

  if (active.nodeType === 'heading') {
    if (parsed.kind === 'heading') {
      // 更新标题级别
      const node = tr.doc.nodeAt(nodePos);
      if (node && node.attrs.level !== parsed.level) {
        tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, level: parsed.level });
      }
    } else {
      // 前缀被删除或改变 → 转为 paragraph
      const node = tr.doc.nodeAt(nodePos);
      if (node) {
        tr.setBlockType(
          nodePos + 1,
          nodePos + node.nodeSize - 1,
          mySchema.nodes.paragraph,
        );
      }
    }
  }

  if (active.nodeType === 'task_item') {
    if (parsed.kind === 'task') {
      // 更新 checked 状态
      const node = tr.doc.nodeAt(nodePos);
      if (node && Boolean(node.attrs.checked) !== parsed.checked) {
        tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, checked: parsed.checked });
      }
    } else if (parsed.kind === 'none') {
      // 前缀被删除 → lift 出任务列表
      // 这需要在 dispatch 后处理，暂时标记
      tryLiftListItem(tr, active);
    }
  }

  // 列表项：如果前缀被完全删除
  if (active.listInfo && active.nodeType === 'paragraph') {
    if (parsed.kind === 'none' && active.prefix.length > 0) {
      tryLiftListItem(tr, active);
    }
  }

  // 引用块：如果前缀被删除
  if (active.blockquotePos !== undefined && parsed.kind !== 'blockquote') {
    tryUnwrapBlockquote(tr, active);
  }
}

function tryLiftListItem(tr: Transaction, active: ActiveLine) {
  if (!active.listInfo) return;
  const itemType = active.listInfo.listItemType === 'task_item'
    ? mySchema.nodes.task_item
    : mySchema.nodes.list_item;

  // 尝试 lift
  try {
    // 构造临时 state 来执行 lift
    const tempState = EditorState.create({ doc: tr.doc, schema: mySchema });
    const $pos = tempState.doc.resolve(active.listInfo.listItemPos + 1);
    const sel = TextSelection.create(tempState.doc, $pos.pos);
    const tempStateWithSel = tempState.apply(tempState.tr.setSelection(sel));

    let liftedTr: Transaction | null = null;
    liftListItem(itemType)(tempStateWithSel, (t: Transaction) => {
      liftedTr = t;
    });
    if (liftedTr) {
      // 把 liftedTr 的 steps 合并到 tr
      const lt = liftedTr as Transaction;
      for (let i = 0; i < lt.steps.length; i++) {
        tr.step(lt.steps[i]);
      }
    }
  } catch {
    // lift 失败，忽略
  }
}

function tryUnwrapBlockquote(tr: Transaction, active: ActiveLine) {
  if (active.blockquotePos === undefined) return;
  try {
    const node = tr.doc.nodeAt(active.blockquotePos);
    if (!node || node.type.name !== 'blockquote') return;
    const slice = new Slice(node.content, 0, 0);
    tr.replaceRange(active.blockquotePos, active.blockquotePos + node.nodeSize, slice);
  } catch {
    // 忽略
  }
}

/**
 * 检测行内定界符的位置范围（用于 Decoration.inline 上色）
 *
 * 双策略：
 * 1. 解析策略（精确）：parse → buildParagraphMap → 对比找定界符
 * 2. 正则策略（宽容）：直接用正则匹配成对的定界符
 *
 * 编辑中间态可能无法精确圆转，此时用正则兜底，保证定界符始终有颜色。
 */
function findDelimiterRanges(text: string): { from: number; to: number }[] {
  if (!text) return [];

  // ── 策略 1：解析圆转（精确） ──
  const parsed = findDelimitersByParsing(text);
  if (parsed) return parsed;

  // ── 策略 2：正则匹配成对定界符（宽容） ──
  return findDelimitersByRegex(text);
}

/** 解析策略：parse → serialize 圆转对比 */
function findDelimitersByParsing(text: string): { from: number; to: number }[] | null {
  try {
    const nodes = parseInlineNodes(text, mySchema);
    if (nodes.length === 0) return null;

    const para = mySchema.nodes.paragraph.create(null, nodes as PMNode[]);
    const { source, pmToSrcAO, pmToSrcBC } = buildParagraphMap(para);

    // 圆转不一致 → 放弃精确策略
    if (source !== text) return null;

    const ranges: { from: number; to: number }[] = [];
    for (let i = 0; i <= para.content.size; i++) {
      const bc = pmToSrcBC[i];
      const ao = pmToSrcAO[i];
      if (ao > bc) {
        ranges.push({ from: bc, to: ao });
      }
    }

    // 末尾闭合定界符
    const lastBC = pmToSrcBC[para.content.size];
    if (source.length > lastBC && !ranges.some(r => r.from === lastBC && r.to === source.length)) {
      ranges.push({ from: lastBC, to: source.length });
    }

    return ranges.length > 0 ? ranges : null;
  } catch {
    return null;
  }
}

/** 正则策略：匹配成对定界符，编辑中间态也能标色 */
function findDelimitersByRegex(text: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  // 已占用位置，防止重叠（如 ** 和 * 冲突）
  const claimed = new Set<number>();

  // 按定界符长度降序，避免 ** 被 * 先抢占
  const patterns: [string, RegExp][] = [
    ['**', /\*\*(.+?)\*\*/g],
    ['~~', /~~(.+?)~~/g],
    ['==', /==(.+?)==/g],
    ['``', /``(.+?)``/g],
    ['`',  /`([^`]+)`/g],
    ['*',  /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g],
    ['~',  /(?<!~)~(?!~)(.+?)(?<!~)~(?!~)/g],
    ['^',  /\^(.+?)\^/g],
  ];

  for (const [delim, pattern] of patterns) {
    // 每次重置 lastIndex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const openFrom = match.index;
      const openTo = openFrom + delim.length;
      const closeFrom = openTo + match[1].length;
      const closeTo = closeFrom + delim.length;

      // 检查是否有位置冲突
      let conflict = false;
      for (let i = openFrom; i < openTo && !conflict; i++) if (claimed.has(i)) conflict = true;
      for (let i = closeFrom; i < closeTo && !conflict; i++) if (claimed.has(i)) conflict = true;
      if (conflict) continue;

      // 占用位置
      for (let i = openFrom; i < openTo; i++) claimed.add(i);
      for (let i = closeFrom; i < closeTo; i++) claimed.add(i);

      ranges.push({ from: openFrom, to: openTo });
      ranges.push({ from: closeFrom, to: closeTo });
    }
  }

  return ranges;
}


// ─── 插件 ───

export const syntaxRevealPlugin: Plugin<SourceLineState> = new Plugin<SourceLineState>({
  key: syntaxRevealKey,

  state: {
    init(): SourceLineState {
      return { activeLine: null };
    },
    apply(tr, prev): SourceLineState {
      const meta = tr.getMeta(syntaxRevealKey);
      if (meta !== undefined) return meta;

      if (!prev.activeLine) return prev;

      // 文档变化时，映射 activeLine 的位置
      if (tr.docChanged) {
        const mapped = tr.mapping.map(prev.activeLine.nodePos);
        const mappedTextStart = tr.mapping.map(prev.activeLine.textStart);
        return {
          activeLine: {
            ...prev.activeLine,
            nodePos: mapped,
            textStart: mappedTextStart,
            listInfo: prev.activeLine.listInfo
              ? {
                  ...prev.activeLine.listInfo,
                  listItemPos: tr.mapping.map(prev.activeLine.listInfo.listItemPos),
                }
              : undefined,
            blockquotePos: prev.activeLine.blockquotePos !== undefined
              ? tr.mapping.map(prev.activeLine.blockquotePos)
              : undefined,
          },
        };
      }

      return prev;
    },
  },

  appendTransaction(
    _transactions: readonly Transaction[],
    oldState: EditorState,
    newState: EditorState,
  ): Transaction | null | undefined {
    if (!newState.selection.empty) {
      // 有选区时，如果之前在源码模式，退出
      const prev = syntaxRevealKey.getState(newState);
      if (prev?.activeLine) {
        return exitSourceMode(newState, prev.activeLine);
      }
      return;
    }

    const prev = syntaxRevealKey.getState(newState);
    const activeLine = prev?.activeLine ?? null;

    // 找到当前光标所在行
    const curLine = findCursorLine(newState);

    // 如果没有可进入的行
    if (!curLine) {
      if (activeLine) {
        return exitSourceMode(newState, activeLine);
      }
      return;
    }

    // 判断是否在同一行
    const sameLineAsActive = activeLine && activeLine.nodePos === curLine.nodePos;

    if (sameLineAsActive) {
      // 仍在同一行，检查是否需要同步块属性
      return syncBlockAttrs(newState, activeLine!, oldState);
    }

    // 光标移到了不同行
    if (activeLine) {
      // 将「退出旧行 + 进入新行」合并为单个 transaction
      // ProseMirror 的 seen 缓存会阻止同一 applyTransaction 周期内
      // 第二次调用 appendTransaction，所以必须在一个 tr 中完成两步
      return exitAndEnterSourceMode(newState, activeLine, curLine);
    }

    // 进入新行的源码模式
    return enterSourceMode(newState, curLine);
  },

  props: {
    decorations(state: EditorState): DecorationSet {
      const pluginState = syntaxRevealKey.getState(state);
      if (!pluginState?.activeLine) return DecorationSet.empty;

      const active = pluginState.activeLine;
      const decorations: Decoration[] = [];

      // 获取活跃行节点
      let node: PMNode | null = null;
      try {
        node = state.doc.nodeAt(active.nodePos);
      } catch {
        return DecorationSet.empty;
      }
      if (!node) return DecorationSet.empty;

      const textStart = active.textStart;
      const textEnd = textStart + node.content.size;

      // 高亮当前块
      if (node.type.name === 'heading' || node.type.name === 'blockquote') {
        decorations.push(
          Decoration.node(active.nodePos, active.nodePos + node.nodeSize, {
            class: `is-active-node active-${node.type.name}`,
          }),
        );
      }

      // 块前缀上色
      if (active.prefixLen > 0 && textStart + active.prefixLen <= textEnd) {
        decorations.push(
          Decoration.inline(textStart, textStart + active.prefixLen, {
            class: 'syntax-prefix',
          }),
        );
      }

      // 行内定界符上色
      const inlineText = node.textContent.slice(active.prefixLen);
      if (inlineText) {
        const delimRanges = findDelimiterRanges(inlineText);
        for (const range of delimRanges) {
          const from = textStart + active.prefixLen + range.from;
          const to = textStart + active.prefixLen + range.to;
          if (from < textEnd && to <= textEnd && from < to) {
            decorations.push(
              Decoration.inline(from, to, {
                class: 'syntax-delimiter',
              }),
            );
          }
        }
      }

      // 活跃列表项标记（隐藏 CSS list-style）
      if (active.listInfo) {
        const itemNode = state.doc.nodeAt(active.listInfo.listItemPos);
        if (itemNode) {
          decorations.push(
            Decoration.node(
              active.listInfo.listItemPos,
              active.listInfo.listItemPos + itemNode.nodeSize,
              { class: 'syntax-active' },
            ),
          );
        }
      }

      if (decorations.length === 0) return DecorationSet.empty;
      return DecorationSet.create(state.doc, decorations);
    },
  },
});

/**
 * 在同一行内，如果文档变化了，同步块属性（如标题级别）
 */
function syncBlockAttrs(
  state: EditorState,
  active: ActiveLine,
  _oldState: EditorState,
): Transaction | null {
  // 只在文档变化时同步
  const node = state.doc.nodeAt(active.nodePos);
  if (!node) return null;

  const plainText = node.textContent;
  const parsed = parseBlockPrefix(plainText);

  // 标题级别同步
  if (active.nodeType === 'heading') {
    if (parsed.kind === 'heading' && parsed.level !== node.attrs.level) {
      const tr = state.tr;
      tr.setMeta('addToHistory', false);
      tr.setNodeMarkup(active.nodePos, undefined, { ...node.attrs, level: parsed.level });
      // 保持 activeLine 状态，更新 prefix
      tr.setMeta(syntaxRevealKey, {
        activeLine: {
          ...active,
          prefixLen: parsed.prefixLen,
          prefix: '#'.repeat(parsed.level) + ' ',
          nodeAttrs: { ...node.attrs, level: parsed.level },
        },
      } as SourceLineState);
      return tr;
    }

    // 前缀不再是有效标题（如 "##Hello" 删除了空格，或 # 全被删了）→ 转为 paragraph
    if (parsed.kind !== 'heading') {
      const tr = state.tr;
      tr.setMeta('addToHistory', false);
      tr.setBlockType(
        active.nodePos + 1,
        active.nodePos + node.nodeSize - 1,
        mySchema.nodes.paragraph,
      );
      tr.setMeta(syntaxRevealKey, {
        activeLine: {
          ...active,
          nodeType: 'paragraph',
          nodeAttrs: {},
          prefixLen: 0,
          prefix: '',
        },
      } as SourceLineState);
      return tr;
    }
  }

  // 任务项 checked 同步
  if (active.nodeType === 'task_item' && parsed.kind === 'task') {
    if (Boolean(node.attrs.checked) !== parsed.checked) {
      const tr = state.tr;
      tr.setMeta('addToHistory', false);
      tr.setNodeMarkup(active.nodePos, undefined, { ...node.attrs, checked: parsed.checked });
      tr.setMeta(syntaxRevealKey, {
        activeLine: {
          ...active,
          nodeAttrs: { ...node.attrs, checked: parsed.checked },
          prefixLen: parsed.prefixLen,
          prefix: `- [${parsed.checked ? 'x' : ' '}] `,
        },
      } as SourceLineState);
      return tr;
    }
  }

  return null;
}
