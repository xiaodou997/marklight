/**
 * 图片扩展
 *
 * 支持本地路径、网络 URL、data URI。
 * Tauri 环境下的 asset:// 协议路径会自动转换。
 */
import Image from '@tiptap/extension-image';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface ImageMarkdownAttrs {
  src: string;
  alt: string;
  title: string | null;
}

export function formatImageMarkdown(attrs: ImageMarkdownAttrs): string {
  const alt = attrs.alt || '';
  const src = attrs.src || '';
  const title = attrs.title?.replace(/"/g, '\\"') ?? '';

  if (title) {
    return `![${alt}](${src} "${title}")`;
  }

  return `![${alt}](${src})`;
}

export function parseImageMarkdown(markdown: string): ImageMarkdownAttrs | null {
  const value = markdown.trim();
  const match = value.match(/^!\[(?<alt>[^\]]*)\]\((?<body>.*)\)$/);

  if (!match?.groups) {
    return null;
  }

  const alt = match.groups.alt ?? '';
  const body = match.groups.body.trim();
  const titleMatch = body.match(/^(?<src>.+?)(?:\s+"(?<title>(?:[^"\\]|\\.)*)")?$/);

  if (!titleMatch?.groups?.src) {
    return null;
  }

  const src = titleMatch.groups.src.trim();
  if (!src) {
    return null;
  }

  return {
    src,
    alt,
    title: titleMatch.groups.title == null ? null : titleMatch.groups.title.replace(/\\"/g, '"'),
  };
}

export const CustomImage = Image.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span');
      dom.className = 'mk-image-shell';
      dom.draggable = false;

      const image = document.createElement('img');
      image.className = 'mk-image';
      image.loading = 'lazy';
      image.draggable = false;
      dom.appendChild(image);

      const sourceText = document.createElement('div');
      sourceText.className = 'mk-image-source-text';
      sourceText.contentEditable = 'plaintext-only';
      sourceText.spellcheck = false;
      sourceText.draggable = false;
      dom.appendChild(sourceText);

      let isEditing = false;

      const getAttrs = (): ImageMarkdownAttrs => ({
        src: (node.attrs.src as string) || '',
        alt: (node.attrs.alt as string) || '',
        title: (node.attrs.title as string | null) ?? null,
      });

      function syncView() {
        const attrs = getAttrs();
        image.src = attrs.src;
        image.alt = attrs.alt;
        image.title = attrs.title ?? '';
        if (!isEditing) {
          sourceText.textContent = formatImageMarkdown(attrs);
        }
      }

      function commit() {
        const parsed = parseImageMarkdown(sourceText.textContent || '');
        if (!parsed) {
          dom.classList.add('is-invalid');
          requestAnimationFrame(() => {
            sourceText.focus();
          });
          return;
        }

        dom.classList.remove('is-invalid');
        isEditing = false;
        dom.classList.remove('is-editing');

        const current = getAttrs();
        if (
          parsed.src === current.src
          && parsed.alt === current.alt
          && parsed.title === current.title
        ) {
          syncView();
          return;
        }

        if (typeof getPos !== 'function') {
          syncView();
          return;
        }

        const pos = getPos();
        if (typeof pos !== 'number') {
          syncView();
          return;
        }
        const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          ...parsed,
        });
        editor.view.dispatch(tr);
      }

      function cancel() {
        isEditing = false;
        dom.classList.remove('is-editing');
        dom.classList.remove('is-invalid');
        syncView();
      }

      dom.addEventListener('dragstart', (event) => {
        event.preventDefault();
      });

      sourceText.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });

      sourceText.addEventListener('focus', () => {
        isEditing = true;
        dom.classList.add('is-editing');
        dom.classList.remove('is-invalid');
      });

      sourceText.addEventListener('blur', () => {
        commit();
      });

      sourceText.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          commit();
          editor.commands.focus();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
          editor.commands.focus();
        }
      });

      syncView();

      return {
        dom,
        update(updatedNode: PMNode) {
          if (updatedNode.type.name !== 'image') {
            return false;
          }

          node = updatedNode;
          syncView();
          return true;
        },
        stopEvent(event: Event) {
          return event.target instanceof Node && sourceText.contains(event.target);
        },
        ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }) {
          return mutation.target instanceof Node && sourceText.contains(mutation.target);
        },
      };
    };
  },
}).configure({
  inline: true,
  allowBase64: true,
  HTMLAttributes: {
    class: 'mk-image',
    loading: 'lazy',
  },
});
