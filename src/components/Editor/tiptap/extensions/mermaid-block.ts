/**
 * Mermaid 图表扩展
 *
 * 支持 ```mermaid ... ``` 代码块自动识别为 Mermaid 图表。
 * 渲染态：Mermaid SVG 图表
 * 点击：进入源码编辑模式
 */
import { Node, mergeAttributes } from '@tiptap/vue-3';
import type { Node as PMNode } from '@tiptap/pm/model';

// 异步加载 mermaid
let mermaidPromise: Promise<typeof import('mermaid')> | null = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        securityLevel: 'loose',
      });
      return mod;
    });
  }
  return mermaidPromise;
}

let mermaidCounter = 0;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
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
    return [{ tag: 'div[data-type="mermaid-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid-block', class: 'mk-mermaid-block' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'mk-mermaid-block';

      // 头部标识
      const badge = document.createElement('div');
      badge.className = 'mk-mermaid-badge';
      badge.textContent = 'mermaid';
      dom.appendChild(badge);

      // 渲染区域
      const renderDiv = document.createElement('div');
      renderDiv.className = 'mk-mermaid-render';
      dom.appendChild(renderDiv);

      // 编辑区域
      const editDiv = document.createElement('div');
      editDiv.className = 'mk-mermaid-edit';
      editDiv.style.display = 'none';

      const textarea = document.createElement('textarea');
      textarea.className = 'mk-mermaid-textarea';
      textarea.placeholder = '输入 Mermaid 图表语法...';
      editDiv.appendChild(textarea);
      dom.appendChild(editDiv);

      let isEditing = false;

      async function renderMermaid(source: string) {
        if (!source.trim()) {
          renderDiv.innerHTML = '<span class="mk-mermaid-placeholder">点击输入 Mermaid 图表</span>';
          return;
        }
        try {
          const mermaid = await getMermaid();
          const id = `mermaid-${++mermaidCounter}`;
          const { svg } = await mermaid.default.render(id, source);
          renderDiv.innerHTML = svg;
        } catch (err: unknown) {
          renderDiv.innerHTML = `<span class="mk-mermaid-error">图表语法错误: ${getErrorMessage(err)}</span>`;
        }
      }

      function enterEdit() {
        if (isEditing) return;
        isEditing = true;
        textarea.value = node.textContent;
        renderDiv.style.display = 'none';
        badge.style.display = 'none';
        editDiv.style.display = 'block';
        textarea.focus();
      }

      function exitEdit() {
        if (!isEditing) return;
        isEditing = false;
        const newSource = textarea.value;
        editDiv.style.display = 'none';
        renderDiv.style.display = 'block';
        badge.style.display = 'block';

        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos != null) {
            const tr = editor.view.state.tr;
            const nodeSize = node.nodeSize;
            const from = pos + 1;
            const to = pos + nodeSize - 1;

            if (newSource) {
              tr.replaceWith(from, to, editor.view.state.schema.text(newSource));
            } else {
              tr.delete(from, to);
            }
            editor.view.dispatch(tr);
          }
        }

        renderMermaid(newSource);
      }

      renderDiv.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        enterEdit();
      });

      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        enterEdit();
      });

      textarea.addEventListener('blur', () => {
        exitEdit();
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          exitEdit();
          editor.commands.focus();
        }
      });

      // 初始渲染
      renderMermaid(node.textContent);

      return {
        dom,
        contentDOM: undefined,
        update(updatedNode: PMNode) {
          if (updatedNode.type.name !== 'mermaidBlock') return false;
          node = updatedNode;
          if (!isEditing) {
            renderMermaid(node.textContent);
          }
          return true;
        },
        stopEvent(event: Event) {
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
