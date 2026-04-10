/**
 * 数学公式块扩展
 *
 * 支持 $$ ... $$ 块级数学公式。
 * 渲染态：KaTeX 渲染的数学公式
 * 点击：进入 LaTeX 源码编辑模式
 */
import { Node, mergeAttributes } from '@tiptap/vue-3';
import type { Node as PMNode } from '@tiptap/pm/model';
import katex from 'katex';

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  isolating: true,

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block', class: 'mk-math-block' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      // 外层容器
      const dom = document.createElement('div');
      dom.className = 'mk-math-block';

      // 渲染区域
      const renderDiv = document.createElement('div');
      renderDiv.className = 'mk-math-render';
      dom.appendChild(renderDiv);

      // 编辑区域（textarea）
      const editDiv = document.createElement('div');
      editDiv.className = 'mk-math-edit';
      editDiv.style.display = 'none';

      const textarea = document.createElement('textarea');
      textarea.className = 'mk-math-textarea';
      textarea.placeholder = '输入 LaTeX 公式...';
      editDiv.appendChild(textarea);
      dom.appendChild(editDiv);

      let isEditing = false;

      function renderKatex(latex: string) {
        if (!latex.trim()) {
          renderDiv.innerHTML = '<span class="mk-math-placeholder">点击输入数学公式</span>';
          return;
        }
        try {
          renderDiv.innerHTML = katex.renderToString(latex, {
            displayMode: true,
            throwOnError: false,
            trust: true,
          });
        } catch {
          renderDiv.innerHTML = `<span class="mk-math-error">${latex}</span>`;
        }
      }

      function enterEdit() {
        if (isEditing) return;
        isEditing = true;
        const latex = node.textContent;
        textarea.value = latex;
        renderDiv.style.display = 'none';
        editDiv.style.display = 'block';
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      }

      function exitEdit() {
        if (!isEditing) return;
        isEditing = false;
        const newLatex = textarea.value;
        editDiv.style.display = 'none';
        renderDiv.style.display = 'block';

        // 更新节点内容
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos != null) {
            const tr = editor.view.state.tr;
            const nodeSize = node.nodeSize;
            const from = pos + 1; // 跳过节点开始
            const to = pos + nodeSize - 1; // 节点结束前

            if (newLatex) {
              tr.replaceWith(from, to, editor.view.state.schema.text(newLatex));
            } else {
              tr.delete(from, to);
            }
            editor.view.dispatch(tr);
          }
        }

        renderKatex(newLatex);
      }

      // 点击渲染区进入编辑
      renderDiv.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        enterEdit();
      });

      // 失焦退出编辑
      textarea.addEventListener('blur', () => {
        exitEdit();
      });

      // Escape 退出编辑
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          exitEdit();
          editor.commands.focus();
        }
      });

      // 初始渲染
      renderKatex(node.textContent);

      return {
        dom,
        // 不让 ProseMirror 管理内容区域
        contentDOM: undefined,
        update(updatedNode: PMNode) {
          if (updatedNode.type.name !== 'mathBlock') return false;
          node = updatedNode;
          if (!isEditing) {
            renderKatex(node.textContent);
          }
          return true;
        },
        stopEvent(event: Event) {
          // 在编辑模式下，拦截所有事件
          if (isEditing) return true;
          return event.type === 'mousedown' || event.type === 'click';
        },
        ignoreMutation() {
          return true;
        },
        destroy() {},
      };
    };
  },
});
