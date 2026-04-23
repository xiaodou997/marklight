import { describe, expect, it } from 'vitest';
import { createMarkdownCompatSchema } from '../../components/Editor/tiptap/markdown/compat-schema';
import {
  buildExportTree,
  renderEditorDocToHtmlDocument,
  renderEditorDocToWechatFragment,
} from '../export-renderer';

function createSemanticDoc() {
  const schema = createMarkdownCompatSchema();

  return schema.nodes.doc.create(null, [
    schema.nodes.frontmatter.create(null, [
      schema.text('title: Export Title\ndescription: Export description\ntags: [alpha, beta]'),
    ]),
    schema.nodes.heading.create({ level: 1 }, [
      schema.nodes.headingMarker.create({ level: 1 }),
      schema.text('Heading'),
    ]),
    schema.nodes.callout.create({ type: 'tip', title: 'Keep going' }, [
      schema.nodes.paragraph.create(null, [
        schema.nodes.wikilink.create({ target: 'Page', alias: 'Alias' }),
      ]),
    ]),
    schema.nodes.paragraph.create(null, [
      schema.nodes.mathInline.create({ latex: 'inline' }),
    ]),
    schema.nodes.mathBlock.create(null, [schema.text('a^2 + b^2 = c^2')]),
    schema.nodes.mermaidBlock.create(null, [schema.text('graph TD\nA-->B')]),
    schema.nodes.table.create(null, [
      schema.nodes.tableRow.create(null, [
        schema.nodes.tableHeader.create(null, [schema.nodes.paragraph.create(null, [schema.text('H1')])]),
        schema.nodes.tableHeader.create(null, [schema.nodes.paragraph.create(null, [schema.text('H2')])]),
      ]),
      schema.nodes.tableRow.create(null, [
        schema.nodes.tableCell.create(null, [schema.nodes.paragraph.create(null, [schema.text('A')])]),
        schema.nodes.tableCell.create(null, [schema.nodes.paragraph.create(null, [schema.text('B')])]),
      ]),
    ]),
    schema.nodes.taskList.create(null, [
      schema.nodes.taskItem.create({ checked: true }, [
        schema.nodes.paragraph.create(null, [schema.text('done')]),
      ]),
    ]),
  ]);
}

describe('buildExportTree', () => {
  it('filters editor-only nodes and keeps stable mark order', () => {
    const schema = createMarkdownCompatSchema();
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.heading.create({ level: 2 }, [
        schema.nodes.headingMarker.create({ level: 2 }),
        schema.text('Export Title'),
      ]),
      schema.nodes.paragraph.create(null, [
        schema.nodes.boldOpen.create(),
        schema.text('Hello', [schema.marks.bold.create(), schema.marks.italic.create()]),
        schema.nodes.boldClose.create(),
      ]),
    ]);

    const tree = buildExportTree(doc);

    expect(tree.blocks).toHaveLength(2);
    expect(tree.blocks[0]).toMatchObject({
      kind: 'heading',
      level: 2,
      inlines: [{ kind: 'text', text: 'Export Title' }],
    });
    expect(tree.blocks[1]).toMatchObject({
      kind: 'paragraph',
      inlines: [
        {
          kind: 'text',
          text: 'Hello',
          marks: [{ kind: 'bold' }, { kind: 'italic' }],
        },
      ],
    });
  });

  it('extracts frontmatter metadata and custom node attrs', () => {
    const schema = createMarkdownCompatSchema();
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.frontmatter.create(null, [
        schema.text('title: Export Doc\ndescription: Structured export\ntags: [alpha, beta]'),
      ]),
      schema.nodes.callout.create({ type: 'warning', title: 'Heads up' }, [
        schema.nodes.paragraph.create(null, [
          schema.nodes.wikilink.create({ target: 'Roadmap', alias: '产品路线图' }),
        ]),
      ]),
    ]);

    const tree = buildExportTree(doc);

    expect(tree.metadata).toMatchObject({
      title: 'Export Doc',
      frontmatter: {
        title: 'Export Doc',
        description: 'Structured export',
        tags: ['alpha', 'beta'],
      },
    });
    expect(tree.blocks[0]).toMatchObject({
      kind: 'callout',
      calloutType: 'warning',
      title: 'Heads up',
      blocks: [
        {
          kind: 'paragraph',
          inlines: [
            {
              kind: 'wikilink',
              target: 'Roadmap',
              alias: '产品路线图',
            },
          ],
        },
      ],
    });
  });
});

describe('renderEditorDocToHtmlDocument', () => {
  it('renders full html document from editor semantics', async () => {
    const doc = createSemanticDoc();

    const html = await renderEditorDocToHtmlDocument(doc, { themeId: 'blue', fileName: 'fallback' });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Export Title</title>');
    expect(html).toContain('<meta name="description" content="Export description" />');
    expect(html).toContain('<meta name="tags" content="alpha, beta" />');
    expect(html).toContain('class="ml-export-callout"');
    expect(html).toContain('data-wikilink="Page"');
    expect(html).not.toContain('wikilink://');
    expect(html).toContain('class="ml-export-math-block"');
    expect(html).toContain('data-mermaid-source="graph TD');
    expect(html).toContain('class="ml-export-table"');
    expect(html).toContain('ml-export-task-list');
    expect(html).not.toContain('<p class="ml-export-paragraph">title: Export Title');
  });
});

describe('renderEditorDocToWechatFragment', () => {
  it('renders fragment html and plain text fallback with target-specific downgrades', () => {
    const schema = createMarkdownCompatSchema();
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.frontmatter.create(null, [schema.text('title: Hidden Frontmatter')]),
      schema.nodes.callout.create({ type: 'note', title: 'Heads up' }, [
        schema.nodes.paragraph.create(null, [schema.nodes.wikilink.create({ target: 'Wiki', alias: '' })]),
      ]),
      schema.nodes.paragraph.create(null, [schema.nodes.mathInline.create({ latex: 'inline' })]),
      schema.nodes.mermaidBlock.create(null, [schema.text('graph TD\nA-->B')]),
    ]);

    const result = renderEditorDocToWechatFragment(doc, { themeId: 'green' });

    expect(result.html).not.toContain('<!doctype html>');
    expect(result.html).toContain('data-callout-type="note"');
    expect(result.html).toContain('data-wikilink="Wiki"');
    expect(result.html).toContain('data-math-inline="true"');
    expect(result.html).toContain('data-mermaid-source="graph TD');
    expect(result.html).not.toContain('Hidden Frontmatter');
    expect(result.text).toContain('Heads up');
    expect(result.text).toContain('Wiki');
  });
});
