import { Node as ProsemirrorNode } from 'prosemirror-model';
import { WechatTheme, getThemeById } from './wechat-themes';

/**
 * 根据主题生成样式配置
 */
function getStyles(theme: WechatTheme) {
  return {
    h1: `font-size: 24px; font-weight: bold; color: ${theme.colors.primary}; border-bottom: 2px solid ${theme.colors.primary}; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px;`,
    h2: `font-size: 20px; font-weight: bold; color: ${theme.colors.primaryDark}; border-left: 4px solid ${theme.colors.primaryDark}; padding-left: 10px; margin-top: 25px; margin-bottom: 12px;`,
    h3: `font-size: 18px; font-weight: bold; color: ${theme.colors.primaryLight}; margin-top: 20px; margin-bottom: 10px;`,
    h4: `font-size: 17px; font-weight: bold; color: ${theme.colors.primaryLight}; margin-top: 18px; margin-bottom: 8px;`,
    h5: `font-size: 16px; font-weight: bold; color: ${theme.colors.primaryLight}; margin-top: 16px; margin-bottom: 8px;`,
    h6: `font-size: 15px; font-weight: bold; color: ${theme.colors.textMuted}; margin-top: 14px; margin-bottom: 6px;`,
    p: `font-size: 16px; color: ${theme.colors.text}; line-height: 1.75; margin-bottom: 1.2em; text-align: justify;`,
    blockquote: `border-left: 4px solid ${theme.colors.blockquoteBorder}; padding: 10px 20px; background-color: ${theme.colors.blockquoteBg}; color: ${theme.colors.textMuted}; font-style: italic; margin: 1.5em 0;`,
    code: `background-color: ${theme.colors.codeBg}; color: ${theme.colors.codeColor}; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 14px;`,
    pre: `background-color: ${theme.colors.preBg}; color: ${theme.colors.preColor}; padding: 15px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 14px; line-height: 1.5; margin: 1.5em 0;`,
    strong: `font-weight: bold; color: ${theme.colors.primary};`,
    em: `font-style: italic;`,
    ul: `margin-bottom: 1.2em; padding-left: 20px; list-style-type: disc;`,
    ol: `margin-bottom: 1.2em; padding-left: 20px; list-style-type: decimal;`,
    li: `margin-bottom: 0.5em; line-height: 1.6;`,
    table: `border-collapse: collapse; width: 100%; margin: 1.5em 0; border: 1px solid ${theme.colors.tableBorder};`,
    th: `background-color: ${theme.colors.tableHeaderBg}; border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px; font-weight: bold;`,
    td: `border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px;`
  };
}

/**
 * 将 ProseMirror Node 转换为带行内样式的 HTML 字符串
 * @param doc ProseMirror 文档节点
 * @param themeId 主题 ID，默认为 'blue'
 */
export function renderToWechatHtml(doc: ProsemirrorNode, themeId: string = 'blue'): string {
  const theme = getThemeById(themeId);
  const STYLES = getStyles(theme);
  
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
        html += `<img src="${node.attrs.src}" alt="${node.attrs.alt || ''}" style="max-width: 100%; border-radius: 8px; margin: 1em 0;" />`;
        break;
      default:
        node.forEach(walk);
    }
  }

  walk(doc);
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px;">${html}</div>`;
}