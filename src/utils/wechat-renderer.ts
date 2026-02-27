import { Node as ProsemirrorNode } from 'prosemirror-model';

/**
 * 微信排版专用样式配置
 */
const STYLES = {
  h1: 'font-size: 24px; font-weight: bold; color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px;',
  h2: 'font-size: 20px; font-weight: bold; color: #1e40af; border-left: 4px solid #1e40af; padding-left: 10px; margin-top: 25px; margin-bottom: 12px;',
  h3: 'font-size: 18px; font-weight: bold; color: #1e3a8a; margin-top: 20px; margin-bottom: 10px;',
  p: 'font-size: 16px; color: #333; line-height: 1.75; margin-bottom: 1.2em; text-align: justify;',
  blockquote: 'border-left: 4px solid #d1d5db; padding: 10px 20px; background-color: #f9fafb; color: #6b7280; font-style: italic; margin: 1.5em 0;',
  code: 'background-color: #f3f4f6; color: #ef4444; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 14px;',
  pre: 'background-color: #1f2937; color: #f9fafb; padding: 15px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 14px; line-height: 1.5; margin: 1.5em 0;',
  strong: 'font-weight: bold; color: #3b82f6;',
  em: 'font-style: italic;',
  ul: 'margin-bottom: 1.2em; padding-left: 20px; list-style-type: disc;',
  ol: 'margin-bottom: 1.2em; padding-left: 20px; list-style-type: decimal;',
  li: 'margin-bottom: 0.5em; line-height: 1.6;',
  table: 'border-collapse: collapse; width: 100%; margin: 1.5em 0; border: 1px solid #e5e7eb;',
  th: 'background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 8px 12px; font-weight: bold;',
  td: 'border: 1px solid #e5e7eb; padding: 8px 12px;'
};

/**
 * 将 ProseMirror Node 转换为带行内样式的 HTML 字符串
 */
export function renderToWechatHtml(doc: ProsemirrorNode): string {
  let html = '';

  function walk(node: ProsemirrorNode) {
    if (node.isText) {
      let text = node.text || '';
      // 处理文本标记 (marks)
      node.marks.forEach(mark => {
        if (mark.type.name === 'strong') text = `<strong style="${STYLES.strong}">${text}</strong>`;
        if (mark.type.name === 'em') text = `<em style="${STYLES.em}">${text}</em>`;
        if (mark.type.name === 'code') text = `<code style="${STYLES.code}">${text}</code>`;
      });
      html += text;
      return;
    }

    const type = node.type.name;
    const style = (STYLES as any)[type] || '';

    switch (type) {
      case 'doc':
        node.forEach(walk);
        break;
      case 'paragraph':
        html += `<p style="${style}">`;
        node.forEach(walk);
        html += `</p>`;
        break;
      case 'heading':
        const level = node.attrs.level;
        const hStyle = (STYLES as any)[`h${level}`] || STYLES.h3;
        html += `<h${level} style="${hStyle}">`;
        node.forEach(walk);
        html += `</h${level}>`;
        break;
      case 'blockquote':
        html += `<blockquote style="${style}">`;
        node.forEach(walk);
        html += `</blockquote>`;
        break;
      case 'bullet_list':
        html += `<ul style="${STYLES.ul}">`;
        node.forEach(walk);
        html += `</ul>`;
        break;
      case 'ordered_list':
        html += `<ol style="${STYLES.ol}">`;
        node.forEach(walk);
        html += `</ol>`;
        break;
      case 'list_item':
        html += `<li style="${STYLES.li}">`;
        node.forEach(walk);
        html += `</li>`;
        break;
      case 'code_block':
        html += `<pre style="${STYLES.pre}"><code>${node.textContent}</code></pre>`;
        break;
      case 'table':
        html += `<table style="${STYLES.table}">`;
        node.forEach(walk);
        html += `</table>`;
        break;
      case 'table_row':
        html += `<tr>`;
        node.forEach(walk);
        html += `</tr>`;
        break;
      case 'table_header':
        html += `<th style="${STYLES.th}">`;
        node.forEach(walk);
        html += `</th>`;
        break;
      case 'table_cell':
        html += `<td style="${STYLES.td}">`;
        node.forEach(walk);
        html += `</td>`;
        break;
      case 'image':
        html += `<img src="${node.attrs.src}" alt="${node.attrs.alt}" style="max-width: 100%; border-radius: 8px; margin: 1em 0;" />`;
        break;
      default:
        node.forEach(walk);
    }
  }

  walk(doc);
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px;">${html}</div>`;
}
