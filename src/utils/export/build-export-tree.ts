import type { Mark, Node as PMNode } from '@tiptap/pm/model';
import { TOKEN_NODE_NAMES } from '../../components/Editor/tiptap/extensions/mark-tokens';
import type {
  ExportBlock,
  ExportCallout,
  ExportDocument,
  ExportFrontmatterValue,
  ExportInline,
  ExportListItem,
  ExportMark,
  ExportMetadata,
  ExportTableCell,
  ExportTableRow,
} from './model';

const EDITOR_ONLY_NODE_NAMES = new Set([...TOKEN_NODE_NAMES, 'headingMarker']);

export function buildExportTree(doc: PMNode): ExportDocument {
  const metadata = extractMetadata(doc);
  const blocks = buildBlocks(doc);

  return {
    kind: 'document',
    metadata,
    blocks,
  };
}

function extractMetadata(doc: PMNode): ExportMetadata {
  const frontmatterNode = findFrontmatterNode(doc);
  const frontmatterRaw = frontmatterNode?.textContent ?? null;
  const frontmatter = frontmatterRaw ? parseFrontmatter(frontmatterRaw) : {};

  const meta = Object.entries(frontmatter)
    .filter(([key]) => key !== 'title')
    .map(([key, value]) => ({
      name: key,
      content: Array.isArray(value) ? value.join(', ') : value,
    }))
    .filter((entry) => entry.content.trim().length > 0);

  return {
    frontmatterRaw,
    frontmatter,
    title: typeof frontmatter.title === 'string' ? frontmatter.title : '',
    meta,
  };
}

function findFrontmatterNode(doc: PMNode): PMNode | null {
  let frontmatterNode: PMNode | null = null;

  doc.forEach((child) => {
    if (!frontmatterNode && child.type.name === 'frontmatter') {
      frontmatterNode = child;
    }
  });

  return frontmatterNode;
}

function buildBlocks(parent: PMNode): ExportBlock[] {
  const blocks: ExportBlock[] = [];

  parent.forEach((child) => {
    const block = buildBlock(child);
    if (block) {
      blocks.push(block);
    }
  });

  return blocks;
}

function buildBlock(node: PMNode): ExportBlock | null {
  if (EDITOR_ONLY_NODE_NAMES.has(node.type.name) || node.type.name === 'frontmatter') {
    return null;
  }

  switch (node.type.name) {
    case 'paragraph':
      return { kind: 'paragraph', inlines: buildInlineContent(node) };
    case 'heading':
      return {
        kind: 'heading',
        level: typeof node.attrs.level === 'number' ? node.attrs.level : 1,
        inlines: buildInlineContent(node),
      };
    case 'blockquote':
      return { kind: 'blockquote', blocks: buildBlocks(node) };
    case 'bulletList':
      return buildList(node, 'bulletList');
    case 'orderedList':
      return {
        kind: 'orderedList',
        start: typeof node.attrs.start === 'number' ? node.attrs.start : 1,
        items: buildListItems(node),
      };
    case 'taskList':
      return {
        kind: 'taskList',
        items: buildListItems(node),
      };
    case 'codeBlock':
      return {
        kind: 'codeBlock',
        language: typeof node.attrs.language === 'string' ? node.attrs.language : null,
        code: node.textContent,
      };
    case 'table':
      return {
        kind: 'table',
        rows: buildTableRows(node),
      };
    case 'mathBlock':
      return { kind: 'mathBlock', latex: node.textContent };
    case 'mermaidBlock':
      return { kind: 'mermaidBlock', source: node.textContent };
    case 'callout':
      return {
        kind: 'callout',
        calloutType: typeof node.attrs.type === 'string' ? node.attrs.type : 'note',
        title: typeof node.attrs.title === 'string' ? node.attrs.title : '',
        blocks: buildBlocks(node),
      } satisfies ExportCallout;
    case 'horizontalRule':
      return { kind: 'horizontalRule' };
    default:
      if (node.isTextblock) {
        return { kind: 'paragraph', inlines: buildInlineContent(node) };
      }
      return null;
  }
}

function buildList(node: PMNode, fallbackKind: 'bulletList'): ExportBlock {
  const items = buildListItems(node);
  const isTaskList = items.length > 0 && items.every((item) => typeof item.checked === 'boolean');

  if (isTaskList) {
    return {
      kind: 'taskList',
      items,
    };
  }

  return {
    kind: fallbackKind,
    items,
  };
}

function buildListItems(node: PMNode): ExportListItem[] {
  const items: ExportListItem[] = [];

  node.forEach((child) => {
    if (child.type.name !== 'listItem' && child.type.name !== 'taskItem') {
      return;
    }

    items.push({
      kind: 'listItem',
      checked: child.type.name === 'taskItem' ? Boolean(child.attrs.checked) : undefined,
      blocks: buildBlocks(child),
    });
  });

  return items;
}

function buildTableRows(node: PMNode): ExportTableRow[] {
  const rows: ExportTableRow[] = [];

  node.forEach((rowNode) => {
    if (rowNode.type.name !== 'tableRow') {
      return;
    }

    const cells: ExportTableCell[] = [];
    rowNode.forEach((cellNode) => {
      if (cellNode.type.name !== 'tableHeader' && cellNode.type.name !== 'tableCell') {
        return;
      }

      cells.push({
        kind: cellNode.type.name,
        blocks: buildBlocks(cellNode),
      });
    });

    rows.push({ kind: 'tableRow', cells });
  });

  return rows;
}

function buildInlineContent(parent: PMNode): ExportInline[] {
  const inlines: ExportInline[] = [];

  parent.forEach((child) => {
    if (EDITOR_ONLY_NODE_NAMES.has(child.type.name)) {
      return;
    }

    if (child.isText) {
      inlines.push({
        kind: 'text',
        text: child.text ?? '',
        marks: buildMarks(child.marks),
      });
      return;
    }

    switch (child.type.name) {
      case 'hardBreak':
        inlines.push({ kind: 'hardBreak', marks: buildMarks(child.marks) });
        return;
      case 'image':
        inlines.push({
          kind: 'image',
          src: typeof child.attrs.src === 'string' ? child.attrs.src : '',
          alt: typeof child.attrs.alt === 'string' ? child.attrs.alt : '',
          title: typeof child.attrs.title === 'string' ? child.attrs.title : null,
          marks: buildMarks(child.marks),
        });
        return;
      case 'mathInline':
        inlines.push({
          kind: 'mathInline',
          latex: typeof child.attrs.latex === 'string' ? child.attrs.latex : '',
          marks: buildMarks(child.marks),
        });
        return;
      case 'wikilink':
        inlines.push({
          kind: 'wikilink',
          target: typeof child.attrs.target === 'string' ? child.attrs.target : '',
          alias: typeof child.attrs.alias === 'string' ? child.attrs.alias : '',
          marks: buildMarks(child.marks),
        });
        return;
      default:
        if (child.textContent) {
          inlines.push({
            kind: 'text',
            text: child.textContent,
            marks: buildMarks(child.marks),
          });
        }
    }
  });

  return inlines;
}

function buildMarks(marks: readonly Mark[]): ExportMark[] {
  return marks
    .map((mark) => {
      switch (mark.type.name) {
        case 'bold':
          return { kind: 'bold' } as const;
        case 'italic':
          return { kind: 'italic' } as const;
        case 'strike':
          return { kind: 'strike' } as const;
        case 'code':
          return { kind: 'code' } as const;
        case 'highlight':
          return { kind: 'highlight' } as const;
        case 'link':
          return {
            kind: 'link',
            href: typeof mark.attrs.href === 'string' ? mark.attrs.href : '',
            title: typeof mark.attrs.title === 'string' ? mark.attrs.title : null,
          } as const;
        case 'superscript':
          return { kind: 'superscript' } as const;
        case 'subscript':
          return { kind: 'subscript' } as const;
        default:
          return null;
      }
    })
    .filter((mark): mark is ExportMark => mark !== null);
}

function parseFrontmatter(raw: string): Record<string, ExportFrontmatterValue> {
  const result: Record<string, ExportFrontmatterValue> = {};
  let currentListKey: string | null = null;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) {
      continue;
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentListKey) {
      const currentValue = result[currentListKey];
      const nextItem = normalizeFrontmatterScalar(listMatch[1]);
      if (Array.isArray(currentValue)) {
        currentValue.push(nextItem);
      } else {
        result[currentListKey] = [nextItem];
      }
      continue;
    }

    currentListKey = null;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    if (!value) {
      result[key] = '';
      currentListKey = key;
      continue;
    }

    const inlineListMatch = value.match(/^\[(.*)\]$/);
    if (inlineListMatch) {
      result[key] = inlineListMatch[1]
        .split(',')
        .map((item) => normalizeFrontmatterScalar(item))
        .filter(Boolean);
      continue;
    }

    result[key] = normalizeFrontmatterScalar(value);
  }

  return result;
}

function normalizeFrontmatterScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}
