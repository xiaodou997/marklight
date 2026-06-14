import { EditorState, TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';

import { createMarkdownCompatSchema } from '../../markdown/compat-schema';
import {
  convertPendingHeading,
  convertPendingInlineMarks,
  revertEmptyHeading,
} from '../markdown-input';

function convertInlineSyntax(text: string) {
  const schema = createMarkdownCompatSchema();
  const paragraph = schema.nodes.paragraph.create(null, [schema.text(text)]);
  const doc = schema.nodes.doc.create(null, [paragraph]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 1 + text.length),
  });

  const tr = convertPendingInlineMarks(state.tr, state);
  return tr ? state.apply(tr).doc.toJSON() : state.doc.toJSON();
}

function markedText(text: string, markName: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', marks: [{ type: markName }], text }],
      },
    ],
  };
}

describe('convertPendingInlineMarks', () => {
  it('converts bold markdown (star) with Chinese text', () => {
    expect(convertInlineSyntax('**加粗**')).toEqual(markedText('加粗', 'bold'));
  });

  it('converts bold markdown (underscore)', () => {
    expect(convertInlineSyntax('__加粗__')).toEqual(markedText('加粗', 'bold'));
  });

  it('converts italic markdown (star and underscore)', () => {
    expect(convertInlineSyntax('*斜体*')).toEqual(markedText('斜体', 'italic'));
    expect(convertInlineSyntax('_斜体_')).toEqual(markedText('斜体', 'italic'));
  });

  it('converts strike markdown', () => {
    expect(convertInlineSyntax('~~删除~~')).toEqual(markedText('删除', 'strike'));
  });

  it('converts code markdown', () => {
    expect(convertInlineSyntax('`code`')).toEqual(markedText('code', 'code'));
  });

  it('converts highlight markdown', () => {
    expect(convertInlineSyntax('==高亮==')).toEqual(markedText('高亮', 'highlight'));
  });

  it('converts superscript and subscript markdown', () => {
    expect(convertInlineSyntax('^sup^')).toEqual(markedText('sup', 'superscript'));
    expect(convertInlineSyntax('~sub~')).toEqual(markedText('sub', 'subscript'));
  });

  it('preserves leading whitespace before markdown markers', () => {
    expect(convertInlineSyntax('hello **world**')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'hello ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'world' },
          ],
        },
      ],
    });
  });

  it('does not convert incomplete markdown', () => {
    expect(convertInlineSyntax('**未完成*')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '**未完成*' }],
        },
      ],
    });
  });
});

describe('convertPendingHeading', () => {
  it('converts a `# 文字` paragraph into a heading once it has content', () => {
    const schema = createMarkdownCompatSchema();
    const state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, [schema.text('# Hello')]),
      ]),
    });

    const tr = convertPendingHeading(state.tr, state.doc, schema.nodes.heading);
    expect(tr).not.toBeNull();

    const heading = state.apply(tr!).doc.firstChild;
    expect(heading?.type.name).toBe('heading');
    expect(heading?.attrs.level).toBe(1);
    expect(heading?.textContent).toBe('Hello');
  });

  it('does not convert a `# ` prefix with no content yet', () => {
    const schema = createMarkdownCompatSchema();
    const state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, [schema.text('# ')]),
      ]),
    });

    expect(convertPendingHeading(state.tr, state.doc, schema.nodes.heading)).toBeNull();
  });
});

describe('revertEmptyHeading', () => {
  it('reverts an empty heading back to a `# ` paragraph', () => {
    const schema = createMarkdownCompatSchema();
    const state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [schema.nodes.heading.create({ level: 2 })]),
    });

    const tr = revertEmptyHeading(state.tr, state.doc);
    expect(tr).not.toBeNull();

    const para = state.apply(tr!).doc.firstChild;
    expect(para?.type.name).toBe('paragraph');
    expect(para?.textContent).toBe('## ');
  });

  it('does not revert a heading that still has content', () => {
    const schema = createMarkdownCompatSchema();
    const state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 1 }, [schema.text('Hello')]),
      ]),
    });

    expect(revertEmptyHeading(state.tr, state.doc)).toBeNull();
  });
});
