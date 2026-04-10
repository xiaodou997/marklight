/**
 * Frontmatter 扩展
 *
 * 支持 YAML frontmatter (--- ... ---) 在文档顶部的显示。
 * 渲染态：显示为折叠的元数据面板
 * 点击：进入 YAML 源码编辑模式
 */
import { Node, mergeAttributes } from '@tiptap/vue-3';
import type { Node as PMNode } from '@tiptap/pm/model';

export const Frontmatter = Node.create({
  name: 'frontmatter',
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
    return [{ tag: 'div[data-type="frontmatter"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'frontmatter', class: 'mk-frontmatter' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'mk-frontmatter';

      // 头部
      const header = document.createElement('div');
      header.className = 'mk-frontmatter-header';
      header.textContent = '▾ FRONTMATTER';
      dom.appendChild(header);

      // 渲染区域（key-value 显示）
      const renderDiv = document.createElement('div');
      renderDiv.className = 'mk-frontmatter-content';
      dom.appendChild(renderDiv);

      // 编辑区域
      const editDiv = document.createElement('div');
      editDiv.className = 'mk-frontmatter-edit';
      editDiv.style.display = 'none';

      const textarea = document.createElement('textarea');
      textarea.className = 'mk-frontmatter-textarea';
      textarea.placeholder = 'title: My Document\ndate: 2026-01-01\ntags: [a, b]';
      editDiv.appendChild(textarea);
      dom.appendChild(editDiv);

      let isEditing = false;
      let isCollapsed = false;

      function renderYaml(yaml: string) {
        if (!yaml.trim()) {
          renderDiv.innerHTML = '<span class="mk-frontmatter-empty">空</span>';
          return;
        }
        // 简单的 key: value 解析和显示
        const lines = yaml.split('\n').filter(l => l.trim());
        renderDiv.innerHTML = lines.map(line => {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim();
            return `<div class="mk-frontmatter-row"><span class="mk-frontmatter-key">${escapeHtml(key)}:</span> <span class="mk-frontmatter-value">${escapeHtml(value)}</span></div>`;
          }
          return `<div class="mk-frontmatter-row">${escapeHtml(line)}</div>`;
        }).join('');
      }

      function escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      function enterEdit() {
        if (isEditing) return;
        isEditing = true;
        textarea.value = node.textContent;
        renderDiv.style.display = 'none';
        editDiv.style.display = 'block';
        textarea.focus();
      }

      function exitEdit() {
        if (!isEditing) return;
        isEditing = false;
        const newYaml = textarea.value;
        editDiv.style.display = 'none';
        renderDiv.style.display = isCollapsed ? 'none' : 'block';

        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos != null) {
            const tr = editor.view.state.tr;
            const nodeSize = node.nodeSize;
            const from = pos + 1;
            const to = pos + nodeSize - 1;

            if (newYaml) {
              tr.replaceWith(from, to, editor.view.state.schema.text(newYaml));
            } else {
              tr.delete(from, to);
            }
            editor.view.dispatch(tr);
          }
        }

        renderYaml(newYaml);
      }

      // 点击头部折叠/展开
      header.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isEditing) return;
        isCollapsed = !isCollapsed;
        header.textContent = isCollapsed ? '▸ FRONTMATTER' : '▾ FRONTMATTER';
        renderDiv.style.display = isCollapsed ? 'none' : 'block';
      });

      // 双击进入编辑
      renderDiv.addEventListener('dblclick', (e) => {
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
      renderYaml(node.textContent);

      return {
        dom,
        contentDOM: undefined,
        update(updatedNode: PMNode) {
          if (updatedNode.type.name !== 'frontmatter') return false;
          node = updatedNode;
          if (!isEditing) {
            renderYaml(node.textContent);
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
