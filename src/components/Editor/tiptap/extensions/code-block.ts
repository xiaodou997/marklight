/**
 * 代码块扩展 — 基于 CodeBlockLowlight
 *
 * 特性：
 * - 语法高亮（lowlight + highlight.js）
 * - 直接在渲染态编辑代码
 * - 支持语言标识
 */
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import type { Node as PMNode } from '@tiptap/pm/model';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

export function normalizeCodeBlockLanguage(language: string | null | undefined): string | null {
  const normalized = language?.trim().toLowerCase() ?? '';
  return normalized || null;
}

export function getCodeBlockLanguageLabel(language: string | null | undefined): string {
  return normalizeCodeBlockLanguage(language) || 'plain text';
}

function updateCodeBlockLanguage(
  editor: any,
  node: PMNode,
  getPos: (() => number | undefined) | boolean,
  language: string | null,
) {
  if (typeof getPos !== 'function') return;

  const pos = getPos();
  if (typeof pos !== 'number') return;
  const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    language,
  });
  editor.view.dispatch(tr);
}

export const CustomCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {};

    return {
      ...parent,
      languageLabel: {
        default: null,
        parseHTML: () => null,
        renderHTML: (attributes) => ({
          'data-language': getCodeBlockLanguageLabel(
            typeof attributes.language === 'string' ? attributes.language : null,
          ),
        }),
      },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'mk-code-block-shell';

      const header = document.createElement('div');
      header.className = 'mk-code-block-header';
      dom.appendChild(header);

      const languageButton = document.createElement('button');
      languageButton.type = 'button';
      languageButton.className = 'mk-code-block-language-button';
      header.appendChild(languageButton);

      const languageInput = document.createElement('input');
      languageInput.className = 'mk-code-block-language-input';
      languageInput.placeholder = '输入语言';
      languageInput.style.display = 'none';
      header.appendChild(languageInput);

      const pre = document.createElement('pre');
      pre.className = 'mk-code-block';
      dom.appendChild(pre);

      const code = document.createElement('code');
      pre.appendChild(code);

      let isEditingLanguage = false;

      function syncLanguageUI() {
        if (isEditingLanguage) return;
        const currentLanguage = typeof node.attrs.language === 'string' ? node.attrs.language : null;
        const label = getCodeBlockLanguageLabel(currentLanguage);
        languageButton.textContent = label;
        pre.dataset.language = label;
      }

      function enterLanguageEdit() {
        if (isEditingLanguage) return;
        isEditingLanguage = true;
        languageButton.style.display = 'none';
        languageInput.style.display = 'block';
        languageInput.value = typeof node.attrs.language === 'string' ? node.attrs.language : '';
        languageInput.focus();
        languageInput.select();
      }

      function exitLanguageEdit() {
        isEditingLanguage = false;
        languageInput.style.display = 'none';
        languageButton.style.display = 'inline-flex';
        syncLanguageUI();
      }

      function commitLanguage() {
        const nextLanguage = normalizeCodeBlockLanguage(languageInput.value);
        const currentLanguage = normalizeCodeBlockLanguage(
          typeof node.attrs.language === 'string' ? node.attrs.language : null,
        );

        exitLanguageEdit();

        if (nextLanguage === currentLanguage) return;
        updateCodeBlockLanguage(editor, node, getPos, nextLanguage);
      }

      function cancelLanguageEdit() {
        exitLanguageEdit();
      }

      languageButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        enterLanguageEdit();
      });

      languageInput.addEventListener('blur', () => {
        commitLanguage();
      });

      languageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitLanguage();
          editor.commands.focus();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          cancelLanguageEdit();
          editor.commands.focus();
        }
      });

      syncLanguageUI();

      return {
        dom,
        contentDOM: code,
        update(updatedNode: PMNode) {
          if (updatedNode.type.name !== 'codeBlock') return false;
          node = updatedNode;
          syncLanguageUI();
          return true;
        },
        stopEvent(event: Event) {
          return event.target instanceof Node && header.contains(event.target);
        },
        ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }) {
          return mutation.target instanceof Node && header.contains(mutation.target);
        },
      };
    };
  },
}).configure({
  lowlight,
  defaultLanguage: null,
  HTMLAttributes: {
    class: 'mk-code-block',
  },
});
