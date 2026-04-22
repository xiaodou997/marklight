import { Node, mergeAttributes } from '@tiptap/vue-3';
import katex from 'katex';

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'math-inline',
        class: 'mk-math-inline',
        'data-latex': node.attrs.latex,
      }),
      node.attrs.latex,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'mk-math-inline';

      function render(latex: string) {
        dom.dataset.latex = latex;
        try {
          dom.innerHTML = katex.renderToString(latex, {
            displayMode: false,
            throwOnError: false,
            trust: true,
          });
        } catch {
          dom.textContent = `$${latex}$`;
        }
      }

      render(typeof node.attrs.latex === 'string' ? node.attrs.latex : '');

      return {
        dom,
        contentDOM: undefined,
        update(updatedNode) {
          if (updatedNode.type.name !== 'mathInline') return false;
          node = updatedNode;
          render(typeof node.attrs.latex === 'string' ? node.attrs.latex : '');
          return true;
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});
