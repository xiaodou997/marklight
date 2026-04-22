/**
 * 方案 C PoC：标题前缀（#）作为一等文档节点
 *
 * 取代 inline-deco.ts 中以 Decoration widget 渲染 `#` 的旧方案。
 * 把 `#` 升格为真实 PM 节点 `headingMarker`：
 *   - 占据真实文档位置，光标 / NodeSelection 行为天然正确
 *   - 与 link / bold 等行内装饰不会再有渲染顺序冲突
 *   - 序列化与解析路径上「#」就是 marker.attrs.level，无歧义
 *
 * 不变量：
 *   每个 heading 的第一个子节点必须是 headingMarker，且
 *   `heading.attrs.level === firstChild.attrs.level`。
 *   由 appendTransaction 强制维护。
 */
import { Node, mergeAttributes } from '@tiptap/vue-3';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode, NodeType } from '@tiptap/pm/model';

const MARKER_NAME = 'headingMarker';
const HEADING_NAME = 'heading';
const LEVELS = [1, 2, 3, 4, 5, 6] as const;
type Level = (typeof LEVELS)[number];

// ── headingMarker：原子 inline 节点 ─────────────────────────────

export const HeadingMarker = Node.create({
  name: MARKER_NAME,
  inline: true,
  atom: true,
  selectable: true,
  // 故意不加入 'inline' group：仅 heading 可在 schema 中显式引用它

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-level')) || 1,
        renderHTML: (attrs) => ({ 'data-level': attrs.level }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-heading-marker]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const level = node.attrs.level as number;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-heading-marker': '',
        class: 'mk-heading-marker',
        contenteditable: 'false',
      }),
      `H${level}`,
    ];
  },
});

// ── 自定义 heading：content 允许 marker 在最前 ─────────────────

export const HeadingWithMarker = Node.create({
  name: HEADING_NAME,
  group: 'block',
  content: `${MARKER_NAME}? inline*`,
  defining: true,

  addOptions() {
    return {
      levels: [...LEVELS] as number[],
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return LEVELS.map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    }));
  },

  renderHTML({ node, HTMLAttributes }) {
    const level = LEVELS.includes(node.attrs.level as Level) ? node.attrs.level : 1;
    return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setHeading:
        (attributes: { level: number }) =>
        ({ commands }: { commands: any }) => {
          if (!LEVELS.includes(attributes.level as Level)) return false;
          return commands.setNode(this.name, attributes);
        },
      toggleHeading:
        (attributes: { level: number }) =>
        ({ commands }: { commands: any }) => {
          if (!LEVELS.includes(attributes.level as Level)) return false;
          return commands.toggleNode(this.name, 'paragraph', attributes);
        },
    } as Partial<Record<string, (...args: any[]) => any>>;
  },

  addInputRules() {
    return LEVELS.map((level) => ({
      find: new RegExp(`^(#{${level}})\\s$`),
      handler: ({ range, chain }: any) => {
        chain()
          .deleteRange({ from: range.from, to: range.to })
          .setNode(this.name, { level })
          .run();
      },
    })) as any;
  },

  addProseMirrorPlugins() {
    return [headingMarkerPlugin()];
  },
});

// ── 维护不变量 + 拦截 # / Backspace ─────────────────────────────

const headingMarkerPluginKey = new PluginKey('headingMarkerPlugin');

function headingMarkerPlugin(): Plugin {
  return new Plugin({
    key: headingMarkerPluginKey,

    props: {
      // 输入 # 提级
      handleTextInput(view, _from, _to, text) {
        if (text !== '#') return false;
        const { state } = view;
        const { selection } = state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const parent = $from.parent;
        if (parent.type.name !== HEADING_NAME) return false;
        if ($from.parentOffset !== 1) return false; // 必须紧贴 marker 之后

        const headingPos = $from.before($from.depth);
        const currentLevel = parent.attrs.level as number;
        if (currentLevel >= 6) return true; // 吞掉 #，不再升级
        const tr = state.tr.setNodeMarkup(headingPos, undefined, {
          ...parent.attrs,
          level: currentLevel + 1,
        });
        view.dispatch(tr);
        return true;
      },

      // Backspace 降级 / 转段落
      handleKeyDown(view, event) {
        if (event.key !== 'Backspace') return false;
        const { state } = view;
        const { selection } = state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const parent = $from.parent;
        if (parent.type.name !== HEADING_NAME) return false;
        if ($from.parentOffset !== 1) return false;

        const headingPos = $from.before($from.depth);
        const currentLevel = parent.attrs.level as number;

        if (currentLevel > 1) {
          const tr = state.tr.setNodeMarkup(headingPos, undefined, {
            ...parent.attrs,
            level: currentLevel - 1,
          });
          view.dispatch(tr);
          return true;
        }

        // H1：删除 marker，转 paragraph
        const paragraphType = state.schema.nodes.paragraph;
        if (!paragraphType) return false;
        const marker = parent.firstChild;
        const tr = state.tr;
        if (marker && marker.type.name === MARKER_NAME) {
          tr.delete(headingPos + 1, headingPos + 1 + marker.nodeSize);
        }
        tr.setBlockType(tr.mapping.map(headingPos), tr.mapping.map(headingPos), paragraphType);
        view.dispatch(tr);
        return true;
      },
    },

    // 维护不变量：每个 heading 必须有 marker 且 level 一致；非 heading 容器内不允许 marker
    appendTransaction(_trs, _oldState, newState) {
      const markerType = newState.schema.nodes[MARKER_NAME] as NodeType | undefined;
      if (!markerType) return null;

      type Action =
        | { kind: 'insertMarker'; pos: number; level: number }
        | { kind: 'syncLevel'; pos: number; level: number }
        | { kind: 'removeOrphan'; from: number; to: number };

      const actions: Action[] = [];

      newState.doc.descendants((node: PMNode, pos, parent) => {
        if (node.type.name === HEADING_NAME) {
          const expectedLevel = node.attrs.level as number;
          const firstChild = node.firstChild;
          if (!firstChild || firstChild.type.name !== MARKER_NAME) {
            actions.push({ kind: 'insertMarker', pos: pos + 1, level: expectedLevel });
          } else if (firstChild.attrs.level !== expectedLevel) {
            actions.push({ kind: 'syncLevel', pos: pos + 1, level: expectedLevel });
          }
          return false; // 不递归到 heading 内部
        }
        // 非 heading 块里的孤儿 marker（理论上不该出现，schema 已约束；防御）
        if (node.type.name === MARKER_NAME && parent && parent.type.name !== HEADING_NAME) {
          actions.push({ kind: 'removeOrphan', from: pos, to: pos + node.nodeSize });
        }
      });

      if (actions.length === 0) return null;

      const tr = newState.tr;
      // 反向应用，避免位置漂移
      for (let i = actions.length - 1; i >= 0; i--) {
        const a = actions[i];
        if (a.kind === 'insertMarker') {
          tr.insert(a.pos, markerType.create({ level: a.level }));
        } else if (a.kind === 'syncLevel') {
          tr.setNodeMarkup(a.pos, undefined, { level: a.level });
        } else if (a.kind === 'removeOrphan') {
          tr.delete(a.from, a.to);
        }
      }
      return tr;
    },
  });
}
