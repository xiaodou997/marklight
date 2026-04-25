import katex from 'katex';
import type {
  ExportBlock,
  ExportDocument,
  ExportInline,
  ExportList,
  ExportListItem,
  ExportMark,
  ExportRenderOptions,
} from '../model';
import { getExportThemeTokens } from '../theme';
import {
  escapeAttribute,
  escapeHtml,
  mergeMetadataTitle,
  wrapMarks,
} from '../utils';

let mermaidCounter = 0;

export async function renderHtmlDocument(
  document: ExportDocument,
  options: ExportRenderOptions = {},
): Promise<string> {
  const theme = getExportThemeTokens(options.themeId);
  const title = mergeMetadataTitle(document.metadata, options.fileName ?? '');
  const metaTags = document.metadata.meta
    .map((entry) => `<meta name="${escapeAttribute(entry.name)}" content="${escapeAttribute(entry.content)}" />`)
    .join('\n');
  const body = await renderBlocks(document.blocks, 'html');

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    metaTags,
    `<style>${getHtmlDocumentStyles(theme.accent, theme.accentStrong, theme.accentSoft, theme.text, theme.textMuted, theme.border, theme.surface, theme.surfaceMuted, theme.codeBackground, theme.codeForeground, theme.preBackground, theme.preForeground)}</style>`,
    '</head>',
    '<body>',
    `<main class="ml-export-root">${body}</main>`,
    '</body>',
    '</html>',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function renderBlocks(blocks: ExportBlock[], target: 'html' | 'wechat'): Promise<string> {
  const rendered: string[] = [];

  for (const block of blocks) {
    rendered.push(await renderBlock(block, target));
  }

  return rendered.join('');
}

async function renderBlock(block: ExportBlock, target: 'html' | 'wechat'): Promise<string> {
  switch (block.kind) {
    case 'paragraph':
      return `<p class="ml-export-paragraph">${renderInlines(block.inlines, target)}</p>`;
    case 'heading':
      return `<h${block.level} class="ml-export-heading ml-export-heading-${block.level}">${renderInlines(block.inlines, target)}</h${block.level}>`;
    case 'blockquote':
      return `<blockquote class="ml-export-blockquote">${await renderBlocks(block.blocks, target)}</blockquote>`;
    case 'bulletList':
      return `<ul class="ml-export-list ml-export-list-bullet">${await renderListItems(block, target)}</ul>`;
    case 'orderedList': {
      const startAttr = block.start && block.start !== 1 ? ` start="${block.start}"` : '';
      return `<ol class="ml-export-list ml-export-list-ordered"${startAttr}>${await renderListItems(block, target)}</ol>`;
    }
    case 'taskList':
      return `<ul class="ml-export-list ml-export-task-list">${await renderListItems(block, target)}</ul>`;
    case 'codeBlock': {
      const language = block.language ? ` data-language="${escapeAttribute(block.language)}"` : '';
      return `<pre class="ml-export-code-block"${language}><code>${escapeHtml(block.code)}</code></pre>`;
    }
    case 'table':
      return `<div class="ml-export-table-wrap"><table class="ml-export-table"><tbody>${block.rows
        .map((row) => `<tr>${row.cells.map(renderTableCell).join('')}</tr>`)
        .join('')}</tbody></table></div>`;
    case 'mathBlock':
      return renderMathBlock(block.latex);
    case 'mermaidBlock':
      return await renderMermaidBlock(block.source);
    case 'callout': {
      const title = block.title || capitalize(block.calloutType);
      return `<aside class="ml-export-callout" data-callout-type="${escapeAttribute(block.calloutType)}"><div class="ml-export-callout-title">${escapeHtml(title)}</div><div class="ml-export-callout-body">${await renderBlocks(block.blocks, target)}</div></aside>`;
    }
    case 'horizontalRule':
      return '<hr class="ml-export-hr" />';
  }
}

async function renderListItems(block: ExportList, target: 'html' | 'wechat'): Promise<string> {
  const rendered: string[] = [];

  for (const item of block.items) {
    rendered.push(await renderListItem(item, block.kind === 'taskList', target));
  }

  return rendered.join('');
}

async function renderListItem(
  item: ExportListItem,
  isTaskItem: boolean,
  target: 'html' | 'wechat',
): Promise<string> {
  const body = await renderListItemBody(item.blocks, target);
  const checkbox = isTaskItem
    ? `<span class="ml-export-task-checkbox" aria-hidden="true">${item.checked ? '☑' : '☐'}</span>`
    : '';
  const checkedAttr = typeof item.checked === 'boolean' ? ` data-checked="${item.checked}"` : '';

  return `<li class="ml-export-list-item"${checkedAttr}>${checkbox}${body}</li>`;
}

async function renderListItemBody(blocks: ExportBlock[], target: 'html' | 'wechat'): Promise<string> {
  if (
    blocks.length === 1 &&
    (blocks[0].kind === 'paragraph' || blocks[0].kind === 'heading')
  ) {
    const block = blocks[0];
    if (block.kind === 'paragraph') {
      return `<span class="ml-export-list-item-inline">${renderInlines(block.inlines, target)}</span>`;
    }
    return `<span class="ml-export-list-item-inline">${renderInlines(block.inlines, target)}</span>`;
  }

  return `<div class="ml-export-list-item-body">${await renderBlocks(blocks, target)}</div>`;
}

function renderTableCell(cell: { kind: 'tableHeader' | 'tableCell'; blocks: ExportBlock[] }): string {
  const tag = cell.kind === 'tableHeader' ? 'th' : 'td';
  const body = cell.blocks.map((block) => renderBlockSync(block)).join('');
  return `<${tag} class="ml-export-table-cell">${body}</${tag}>`;
}

function renderBlockSync(block: ExportBlock): string {
  switch (block.kind) {
    case 'paragraph':
      return `<p class="ml-export-paragraph">${renderInlines(block.inlines, 'html')}</p>`;
    case 'heading':
      return `<p class="ml-export-table-heading">${renderInlines(block.inlines, 'html')}</p>`;
    case 'blockquote':
      return `<blockquote class="ml-export-blockquote">${block.blocks.map(renderBlockSync).join('')}</blockquote>`;
    case 'bulletList':
      return `<ul class="ml-export-list ml-export-list-bullet">${block.items
        .map((item) => `<li class="ml-export-list-item">${item.blocks.map(renderBlockSync).join('')}</li>`)
        .join('')}</ul>`;
    case 'orderedList':
      return `<ol class="ml-export-list ml-export-list-ordered">${block.items
        .map((item) => `<li class="ml-export-list-item">${item.blocks.map(renderBlockSync).join('')}</li>`)
        .join('')}</ol>`;
    case 'taskList':
      return `<ul class="ml-export-list ml-export-task-list">${block.items
        .map((item) => `<li class="ml-export-list-item"><span class="ml-export-task-checkbox">${item.checked ? '☑' : '☐'}</span>${item.blocks.map(renderBlockSync).join('')}</li>`)
        .join('')}</ul>`;
    case 'codeBlock':
      return `<pre class="ml-export-code-block"><code>${escapeHtml(block.code)}</code></pre>`;
    case 'table':
      return `<table class="ml-export-table"><tbody>${block.rows
        .map((row) => `<tr>${row.cells.map(renderTableCell).join('')}</tr>`)
        .join('')}</tbody></table>`;
    case 'mathBlock':
      return renderMathBlock(block.latex);
    case 'mermaidBlock':
      return renderMermaidFallback(block.source);
    case 'callout':
      return `<aside class="ml-export-callout" data-callout-type="${escapeAttribute(block.calloutType)}"><div class="ml-export-callout-title">${escapeHtml(block.title || capitalize(block.calloutType))}</div><div class="ml-export-callout-body">${block.blocks.map(renderBlockSync).join('')}</div></aside>`;
    case 'horizontalRule':
      return '<hr class="ml-export-hr" />';
  }
}

function renderInlines(inlines: ExportInline[], target: 'html' | 'wechat'): string {
  return inlines.map((inline) => renderInline(inline, target)).join('');
}

function renderInline(inline: ExportInline, target: 'html' | 'wechat'): string {
  let content: string;

  switch (inline.kind) {
    case 'text':
      content = escapeHtml(inline.text);
      return wrapMarks(content, inline.marks, renderMark);
    case 'hardBreak':
      content = '<br />';
      return wrapMarks(content, inline.marks, renderMark);
    case 'image':
      content = `<img class="ml-export-image" src="${escapeAttribute(inline.src)}" alt="${escapeAttribute(inline.alt)}"${inline.title ? ` title="${escapeAttribute(inline.title)}"` : ''} />`;
      return wrapMarks(content, inline.marks, renderMark);
    case 'mathInline':
      content =
        target === 'wechat'
          ? `<code class="ml-export-inline-math-fallback">${escapeHtml(inline.latex)}</code>`
          : renderInlineMath(inline.latex);
      return wrapMarks(content, inline.marks, renderMark);
    case 'wikilink': {
      const label = inline.alias || inline.target;
      content = `<span class="ml-export-wikilink" role="link" data-wikilink="${escapeAttribute(inline.target)}" title="${escapeAttribute(inline.target)}">${escapeHtml(label)}</span>`;
      return wrapMarks(content, inline.marks, renderMark);
    }
  }
}

function renderMark(content: string, mark: ExportMark): string {
  switch (mark.kind) {
    case 'bold':
      return `<strong>${content}</strong>`;
    case 'italic':
      return `<em>${content}</em>`;
    case 'strike':
      return `<s>${content}</s>`;
    case 'code':
      return `<code>${content}</code>`;
    case 'highlight':
      return `<mark>${content}</mark>`;
    case 'link': {
      const titleAttr = mark.title ? ` title="${escapeAttribute(mark.title)}"` : '';
      return `<a href="${escapeAttribute(mark.href)}"${titleAttr}>${content}</a>`;
    }
    case 'superscript':
      return `<sup>${content}</sup>`;
    case 'subscript':
      return `<sub>${content}</sub>`;
  }
}

function renderInlineMath(latex: string): string {
  return `<span class="ml-export-inline-math" data-latex="${escapeAttribute(latex)}">${katex.renderToString(latex, {
    displayMode: false,
    throwOnError: false,
    trust: true,
  })}</span>`;
}

function renderMathBlock(latex: string): string {
  return `<div class="ml-export-math-block" data-latex="${escapeAttribute(latex)}">${katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    trust: true,
  })}</div>`;
}

async function renderMermaidBlock(source: string): Promise<string> {
  const svg = await renderMermaidSvg(source);
  if (svg) {
    return `<figure class="ml-export-mermaid" data-mermaid-source="${escapeAttribute(source)}">${svg}</figure>`;
  }

  return renderMermaidFallback(source);
}

async function renderMermaidSvg(source: string): Promise<string | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  try {
    const mermaidModule = await import('mermaid');
    const mermaid = mermaidModule.default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    });
    const id = `marklight-export-mermaid-${mermaidCounter += 1}`;
    const { svg } = await mermaid.render(id, source);
    return svg;
  } catch {
    return null;
  }
}

function renderMermaidFallback(source: string): string {
  return `<figure class="ml-export-mermaid-fallback" data-mermaid-source="${escapeAttribute(source)}"><figcaption>Mermaid</figcaption><pre>${escapeHtml(source)}</pre></figure>`;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Note';
}

function getHtmlDocumentStyles(
  accent: string,
  accentStrong: string,
  accentSoft: string,
  text: string,
  textMuted: string,
  border: string,
  surface: string,
  surfaceMuted: string,
  codeBackground: string,
  codeForeground: string,
  preBackground: string,
  preForeground: string,
): string {
  return `
    :root {
      color-scheme: light;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      background: ${surfaceMuted};
      color: ${text};
      font-family: "SF Pro Text", "PingFang SC", "Noto Sans SC", sans-serif;
    }
    .ml-export-root {
      width: min(880px, calc(100vw - 48px));
      margin: 32px auto;
      padding: 40px 48px;
      background: ${surface};
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
    }
    .ml-export-root > :first-child {
      margin-top: 0;
    }
    .ml-export-root > :last-child {
      margin-bottom: 0;
    }
    .ml-export-heading {
      line-height: 1.25;
      margin: 1.8em 0 0.8em;
      color: ${accentStrong};
    }
    .ml-export-heading-1 {
      font-size: 2.1rem;
      border-bottom: 3px solid ${accent};
      padding-bottom: 0.4rem;
    }
    .ml-export-heading-2 {
      font-size: 1.6rem;
      border-left: 4px solid ${accent};
      padding-left: 0.75rem;
    }
    .ml-export-heading-3,
    .ml-export-heading-4,
    .ml-export-heading-5,
    .ml-export-heading-6 {
      color: ${accentSoft};
    }
    .ml-export-paragraph,
    .ml-export-list-item,
    .ml-export-table-cell,
    .ml-export-table-heading {
      line-height: 1.8;
      margin: 0 0 1em;
    }
    .ml-export-blockquote {
      margin: 1.5em 0;
      padding: 1em 1.2em;
      border-left: 4px solid ${accent};
      background: ${surfaceMuted};
      color: ${textMuted};
    }
    .ml-export-list {
      padding-left: 1.4em;
      margin: 0 0 1.2em;
    }
    .ml-export-list-item {
      margin-bottom: 0.6em;
    }
    .ml-export-list-item-inline {
      display: inline;
    }
    .ml-export-task-list {
      list-style: none;
      padding-left: 0;
    }
    .ml-export-task-checkbox {
      display: inline-block;
      margin-right: 0.55em;
      color: ${accentStrong};
      font-weight: 700;
    }
    .ml-export-code-block,
    .ml-export-mermaid-fallback pre {
      overflow-x: auto;
      padding: 16px 18px;
      border-radius: 16px;
      background: ${preBackground};
      color: ${preForeground};
      font-family: "SFMono-Regular", "JetBrains Mono", monospace;
      font-size: 0.92rem;
      line-height: 1.65;
      margin: 1.4em 0;
    }
    code {
      background: ${codeBackground};
      color: ${codeForeground};
      border-radius: 6px;
      padding: 0.15em 0.35em;
      font-family: "SFMono-Regular", "JetBrains Mono", monospace;
      font-size: 0.92em;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }
    .ml-export-table-wrap {
      overflow-x: auto;
      margin: 1.4em 0;
    }
    .ml-export-table {
      width: 100%;
      border-collapse: collapse;
    }
    .ml-export-table-cell {
      min-width: 120px;
      border: 1px solid ${border};
      padding: 0.8em 0.95em;
      vertical-align: top;
    }
    th.ml-export-table-cell {
      background: ${surfaceMuted};
      color: ${accentStrong};
      text-align: left;
    }
    .ml-export-image {
      max-width: 100%;
      border-radius: 14px;
      display: inline-block;
      vertical-align: middle;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
    }
    .ml-export-callout {
      margin: 1.5em 0;
      padding: 1.1em 1.25em;
      border-radius: 18px;
      border: 1px solid ${border};
      background: linear-gradient(135deg, ${surfaceMuted}, ${surface});
    }
    .ml-export-callout-title {
      font-weight: 700;
      color: ${accentStrong};
      margin-bottom: 0.7em;
    }
    .ml-export-wikilink {
      color: ${accentStrong};
      border-bottom: 1px dashed ${accent};
      cursor: default;
    }
    .ml-export-inline-math,
    .ml-export-math-block {
      overflow-x: auto;
    }
    .ml-export-inline-math-fallback {
      white-space: nowrap;
    }
    .ml-export-math-block {
      margin: 1.5em 0;
      padding: 1.1em 1.25em;
      border-radius: 18px;
      background: ${surfaceMuted};
    }
    .ml-export-mermaid,
    .ml-export-mermaid-fallback {
      margin: 1.5em 0;
      padding: 1.1em 1.25em;
      border: 1px solid ${border};
      border-radius: 18px;
      background: ${surface};
    }
    .ml-export-mermaid-fallback figcaption {
      color: ${textMuted};
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.8em;
    }
    .ml-export-hr {
      border: 0;
      border-top: 1px solid ${border};
      margin: 2em 0;
    }
    a {
      color: ${accentStrong};
    }
    mark {
      background: rgba(250, 204, 21, 0.35);
      border-radius: 4px;
      padding: 0.08em 0.2em;
    }
    @media (max-width: 768px) {
      .ml-export-root {
        width: calc(100vw - 24px);
        margin: 12px auto;
        padding: 24px 18px;
        border-radius: 18px;
      }
    }
  `;
}
