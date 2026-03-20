import { EditorView } from '@codemirror/view';

function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false;
  return /^[ \t]*([#*>-]|\d+[.)]\s|\|)/m.test(text) ||
    /(\*\*|__|~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\))/.test(text);
}

function hasRichFormatting(html: string): boolean {
  return /<(strong|b|em|i|code|pre|a|h[1-6]|ul|ol|li|blockquote|img)\b/i.test(html);
}

function textContent(node: Node): string {
  return node.textContent?.replace(/\u00a0/g, ' ') ?? '';
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return textContent(node);
  if (!(node instanceof HTMLElement)) return '';

  const children = Array.from(node.childNodes).map(inlineToMarkdown).join('');
  const tag = node.tagName.toLowerCase();

  if (tag === 'strong' || tag === 'b') return `**${children}**`;
  if (tag === 'em' || tag === 'i') return `*${children}*`;
  if (tag === 'code') return `\`${children}\``;
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    const label = children.trim() || href;
    return href ? `[${label}](${href})` : label;
  }
  if (tag === 'br') return '\n';
  if (tag === 'img') {
    const src = node.getAttribute('src') || '';
    const alt = node.getAttribute('alt') || 'image';
    return src ? `![${alt}](${src})` : '';
  }
  return children;
}

function blockToMarkdown(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const rawChildren = Array.from(el.childNodes);

  if (tag === 'pre') {
    const codeEl = el.querySelector('code');
    const code = codeEl ? codeEl.textContent ?? '' : el.textContent ?? '';
    const cls = codeEl?.className ?? '';
    const lang = cls.match(/language-([a-z0-9_-]+)/i)?.[1] ?? '';
    return `\`\`\`${lang}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`;
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    return `${'#'.repeat(level)} ${rawChildren.map(inlineToMarkdown).join('').trim()}\n\n`;
  }

  if (tag === 'blockquote') {
    const body = rawChildren.map((n) => {
      if (n instanceof HTMLElement) return blockToMarkdown(n).trimEnd();
      return inlineToMarkdown(n);
    }).join('').trim();
    if (!body) return '';
    return body.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
  }

  if (tag === 'ul' || tag === 'ol') {
    const isOrdered = tag === 'ol';
    const items = Array.from(el.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((li, idx) => {
        const content = Array.from(li.childNodes).map(inlineToMarkdown).join('').trim();
        const marker = isOrdered ? `${idx + 1}. ` : '- ';
        return `${marker}${content}`;
      });
    return items.join('\n') + '\n\n';
  }

  if (tag === 'hr') {
    return '---\n\n';
  }

  if (tag === 'p' || tag === 'div') {
    const text = rawChildren.map(inlineToMarkdown).join('').trim();
    if (!text) return '';
    return `${text}\n\n`;
  }

  return `${rawChildren.map(inlineToMarkdown).join('')}\n\n`;
}

function htmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const chunks: string[] = [];
  for (const node of Array.from(doc.body.childNodes)) {
    if (node instanceof HTMLElement) {
      chunks.push(blockToMarkdown(node));
    } else {
      const text = inlineToMarkdown(node).trim();
      if (text) chunks.push(`${text}\n\n`);
    }
  }
  return chunks.join('').replace(/\n{3,}/g, '\n\n').trim();
}

function insertText(view: EditorView, text: string): void {
  const range = view.state.selection.main;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: { anchor: range.from + text.length },
  });
}

export function createSmartPasteExtension() {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const clipboard = event.clipboardData;
      if (!clipboard) return false;

      for (const item of Array.from(clipboard.items)) {
        if (item.type.startsWith('image/')) {
          return false;
        }
      }

      const plainText = clipboard.getData('text/plain');
      if (plainText && looksLikeMarkdown(plainText)) {
        return false;
      }

      const html = clipboard.getData('text/html');
      if (!html || !hasRichFormatting(html)) {
        return false;
      }

      const markdown = htmlToMarkdown(html);
      if (!markdown) return false;

      event.preventDefault();
      insertText(view, markdown);
      return true;
    },
  });
}
