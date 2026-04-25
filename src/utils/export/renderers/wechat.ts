import type { ExportBlock, ExportDocument, ExportInline, ExportListItem, ExportMark, ExportRenderOptions, WechatRenderResult } from '../model';
import { getExportThemeTokens } from '../theme';
import { escapeAttribute, escapeHtml, renderPlainText, wrapMarks } from '../utils';

export function renderWechatFragment(
  document: ExportDocument,
  options: ExportRenderOptions = {},
): WechatRenderResult {
  const theme = getExportThemeTokens(options.themeId);
  const html = `<section style="${rootStyle(theme.text)}">${document.blocks
    .map((block) => renderBlock(block, theme))
    .join('')}</section>`;

  return {
    html,
    text: renderPlainText(document),
  };
}

function renderBlock(block: ExportBlock, theme: ReturnType<typeof getExportThemeTokens>): string {
  switch (block.kind) {
    case 'paragraph':
      return `<p style="margin:0 0 1.2em;line-height:1.8;color:${theme.text};font-size:16px;">${renderInlines(block.inlines, theme)}</p>`;
    case 'heading': {
      const size = Math.max(18, 30 - block.level * 2);
      const border = block.level <= 2 ? `border-${block.level === 1 ? 'bottom' : 'left'}:${block.level === 1 ? '3px solid' : '4px solid'} ${theme.accent};padding-${block.level === 1 ? 'bottom' : 'left'}:${block.level === 1 ? '8px' : '12px'};` : '';
      return `<h${block.level} style="margin:1.6em 0 0.8em;color:${theme.accentStrong};font-size:${size}px;line-height:1.35;${border}">${renderInlines(block.inlines, theme)}</h${block.level}>`;
    }
    case 'blockquote':
      return `<blockquote style="margin:1.4em 0;padding:12px 16px;border-left:4px solid ${theme.accent};background:${theme.surfaceMuted};color:${theme.textMuted};">${block.blocks.map((child) => renderBlock(child, theme)).join('')}</blockquote>`;
    case 'bulletList':
      return `<ul style="margin:0 0 1.2em;padding-left:1.4em;">${block.items.map((item) => renderListItem(item, false, theme)).join('')}</ul>`;
    case 'orderedList':
      return `<ol style="margin:0 0 1.2em;padding-left:1.4em;">${block.items.map((item) => renderListItem(item, false, theme)).join('')}</ol>`;
    case 'taskList':
      return `<ul style="margin:0 0 1.2em;padding-left:0;list-style:none;">${block.items.map((item) => renderListItem(item, true, theme)).join('')}</ul>`;
    case 'codeBlock':
      return `<pre style="margin:1.4em 0;padding:14px 16px;border-radius:12px;background:${theme.preBackground};color:${theme.preForeground};font-size:14px;line-height:1.65;overflow-x:auto;"><code>${escapeHtml(block.code)}</code></pre>`;
    case 'table':
      return `<table style="width:100%;border-collapse:collapse;margin:1.4em 0;">${block.rows
        .map((row) => `<tr>${row.cells
          .map((cell) => {
            const tag = cell.kind === 'tableHeader' ? 'th' : 'td';
            const bg = cell.kind === 'tableHeader' ? theme.surfaceMuted : '#ffffff';
            return `<${tag} style="border:1px solid ${theme.border};padding:8px 10px;background:${bg};text-align:left;vertical-align:top;">${cell.blocks
              .map((child) => renderBlock(child, theme))
              .join('')}</${tag}>`;
          })
          .join('')}</tr>`)
        .join('')}</table>`;
    case 'mathBlock':
      return `<pre data-math-block="true" style="margin:1.4em 0;padding:12px 14px;border-radius:12px;background:${theme.surfaceMuted};color:${theme.text};font-size:14px;white-space:pre-wrap;">${escapeHtml(block.latex)}</pre>`;
    case 'mermaidBlock':
      return `<section data-mermaid-source="${escapeAttribute(block.source)}" style="margin:1.4em 0;padding:12px 14px;border:1px solid ${theme.border};border-radius:12px;background:#ffffff;"><div style="margin-bottom:8px;color:${theme.textMuted};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Mermaid</div><pre style="margin:0;white-space:pre-wrap;color:${theme.text};">${escapeHtml(block.source)}</pre></section>`;
    case 'callout': {
      const title = block.title || capitalize(block.calloutType);
      return `<section data-callout-type="${escapeAttribute(block.calloutType)}" style="margin:1.4em 0;padding:12px 14px;border-left:4px solid ${theme.accent};background:${theme.surfaceMuted};border-radius:10px;"><div style="margin-bottom:8px;color:${theme.accentStrong};font-weight:700;">${escapeHtml(title)}</div>${block.blocks.map((child) => renderBlock(child, theme)).join('')}</section>`;
    }
    case 'horizontalRule':
      return `<hr style="border:none;border-top:1px solid ${theme.border};margin:1.6em 0;" />`;
  }
}

function renderListItem(item: ExportListItem, isTaskItem: boolean, theme: ReturnType<typeof getExportThemeTokens>): string {
  const prefix = isTaskItem
    ? `<span style="display:inline-block;margin-right:8px;color:${theme.accentStrong};font-weight:700;">${item.checked ? '☑' : '☐'}</span>`
    : '';

  if (
    item.blocks.length === 1 &&
    (item.blocks[0].kind === 'paragraph' || item.blocks[0].kind === 'heading')
  ) {
    const block = item.blocks[0];
    const body = block.kind === 'paragraph' ? renderInlines(block.inlines, theme) : renderInlines(block.inlines, theme);
    return `<li style="margin-bottom:8px;line-height:1.7;color:${theme.text};">${prefix}${body}</li>`;
  }

  return `<li style="margin-bottom:8px;color:${theme.text};">${prefix}${item.blocks
    .map((child) => renderBlock(child, theme))
    .join('')}</li>`;
}

function renderInlines(inlines: ExportInline[], theme: ReturnType<typeof getExportThemeTokens>): string {
  return inlines.map((inline) => renderInline(inline, theme)).join('');
}

function renderInline(inline: ExportInline, theme: ReturnType<typeof getExportThemeTokens>): string {
  let content: string;

  switch (inline.kind) {
    case 'text':
      content = escapeHtml(inline.text);
      return wrapMarks(content, inline.marks, (inner, mark) => renderMark(inner, mark, theme));
    case 'hardBreak':
      return '<br />';
    case 'image':
      content = `<img src="${escapeAttribute(inline.src)}" alt="${escapeAttribute(inline.alt)}" style="max-width:100%;border-radius:12px;display:block;margin:12px auto;"${inline.title ? ` title="${escapeAttribute(inline.title)}"` : ''} />`;
      return wrapMarks(content, inline.marks, (inner, mark) => renderMark(inner, mark, theme));
    case 'mathInline':
      content = `<code data-math-inline="true" style="padding:1px 4px;border-radius:4px;background:${theme.codeBackground};color:${theme.codeForeground};">${escapeHtml(inline.latex)}</code>`;
      return wrapMarks(content, inline.marks, (inner, mark) => renderMark(inner, mark, theme));
    case 'wikilink': {
      const label = inline.alias || inline.target;
      content = `<span data-wikilink="${escapeAttribute(inline.target)}" style="color:${theme.accentStrong};border-bottom:1px dashed ${theme.accent};">${escapeHtml(label)}</span>`;
      return wrapMarks(content, inline.marks, (inner, mark) => renderMark(inner, mark, theme));
    }
  }
}

function renderMark(content: string, mark: ExportMark, theme: ReturnType<typeof getExportThemeTokens>): string {
  switch (mark.kind) {
    case 'bold':
      return `<strong>${content}</strong>`;
    case 'italic':
      return `<em>${content}</em>`;
    case 'strike':
      return `<span style="text-decoration:line-through;">${content}</span>`;
    case 'code':
      return `<code style="padding:1px 4px;border-radius:4px;background:${theme.codeBackground};color:${theme.codeForeground};">${content}</code>`;
    case 'highlight':
      return `<mark style="background:#fef08a;padding:1px 2px;border-radius:3px;">${content}</mark>`;
    case 'link': {
      const titleAttr = mark.title ? ` title="${escapeAttribute(mark.title)}"` : '';
      return `<a href="${escapeAttribute(mark.href)}" style="color:${theme.accent};text-decoration:underline;"${titleAttr}>${content}</a>`;
    }
    case 'superscript':
      return `<sup>${content}</sup>`;
    case 'subscript':
      return `<sub>${content}</sub>`;
  }
}

function rootStyle(text: string): string {
  return `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;color:${text};font-size:16px;`;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Note';
}
