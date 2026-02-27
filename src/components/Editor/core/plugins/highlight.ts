import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node as ProsemirrorNode } from 'prosemirror-model';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

export const highlightKey = new PluginKey('highlight');

/**
 * 获取高亮装饰器
 */
function getDecorations(doc: ProsemirrorNode) {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'code_block') {
      const language = node.attrs.params || '';
      const text = node.textContent;
      if (!text) return;

      try {
        const tree = language && language !== 'text' && lowlight.registered(language)
          ? lowlight.highlight(language, text)
          : lowlight.highlightAuto(text);

        let offset = 0;

        // Walk hast tree, accumulating class names from parent elements.
        // Only create decorations at text leaf nodes to get correct positions.
        const walk = (nodes: any[], inheritedClasses: string[]) => {
          for (const n of nodes) {
            if (n.type === 'text') {
              if (inheritedClasses.length > 0) {
                const start = pos + 1 + offset;
                const end = start + n.value.length;
                decorations.push(
                  Decoration.inline(start, end, {
                    class: inheritedClasses.join(' '),
                  })
                );
              }
              offset += n.value.length;
            } else if (n.type === 'element') {
              // lowlight class names already have hljs- prefix
              const classes = [...inheritedClasses, ...(n.properties?.className || [])];
              walk(n.children, classes);
            }
          }
        };

        walk(tree.children, []);
      } catch (e) {
        // silently ignore highlight failures
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const highlightPlugin = new Plugin({
  key: highlightKey,
  state: {
    init(_, { doc }) {
      return getDecorations(doc);
    },
    apply(tr, set) {
      return tr.docChanged ? getDecorations(tr.doc) : set;
    },
  },
  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});
