import type {
  ExportBlock,
  ExportDocument,
  ExportInline,
  ExportListItem,
  ExportMark,
  ExportMetadata,
} from './model';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

export function slugifyMetaName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export function getInlineText(inlines: ExportInline[]): string {
  return inlines
    .map((inline) => {
      switch (inline.kind) {
        case 'text':
          return inline.text;
        case 'hardBreak':
          return '\n';
        case 'image':
          return inline.alt || inline.title || inline.src;
        case 'mathInline':
          return inline.latex;
        case 'wikilink':
          return inline.alias || inline.target;
      }
    })
    .join('');
}

export function getBlockText(block: ExportBlock): string {
  switch (block.kind) {
    case 'paragraph':
      return getInlineText(block.inlines);
    case 'heading':
      return getInlineText(block.inlines);
    case 'blockquote':
      return block.blocks.map(getBlockText).join('\n');
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return block.items.map(getListItemText).join('\n');
    case 'codeBlock':
      return block.code;
    case 'table':
      return block.rows
        .map((row) => row.cells.map((cell) => cell.blocks.map(getBlockText).join(' ')).join(' | '))
        .join('\n');
    case 'mathBlock':
      return block.latex;
    case 'mermaidBlock':
      return block.source;
    case 'callout':
      return [block.title || block.calloutType, ...block.blocks.map(getBlockText)].filter(Boolean).join('\n');
    case 'horizontalRule':
      return '---';
  }
}

export function getListItemText(item: ExportListItem): string {
  return item.blocks.map(getBlockText).join('\n');
}

export function renderPlainText(document: ExportDocument): string {
  return document.blocks.map(getBlockText).join('\n\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function mergeMetadataTitle(metadata: ExportMetadata, fallback: string): string {
  return metadata.title.trim() || fallback.trim() || 'MarkLight Export';
}

export function wrapMarks(
  content: string,
  marks: ExportMark[],
  wrap: (content: string, mark: ExportMark) => string,
): string {
  let result = content;
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    result = wrap(result, marks[i]);
  }
  return result;
}
