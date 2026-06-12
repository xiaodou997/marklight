import { EditorState, TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';

import { createMarkdownCompatSchema } from '../../markdown/compat-schema';
import { convertPendingInlineMarks } from '../semantic-inline-marks';

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

describe('convertPendingInlineMarks', () => {
  it('converts bold markdown with Chinese text', () => {
    expect(convertInlineSyntax('**加粗**')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: '加粗' }],
        },
      ],
    });
  });

  it('converts code markdown', () => {
    expect(convertInlineSyntax('`code`')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'code' }], text: 'code' }],
        },
      ],
    });
  });

  it('converts highlight markdown', () => {
    expect(convertInlineSyntax('==高亮==')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'highlight' }], text: '高亮' }],
        },
      ],
    });
  });

  it('converts superscript and subscript markdown', () => {
    expect(convertInlineSyntax('^sup^')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'superscript' }], text: 'sup' }],
        },
      ],
    });

    expect(convertInlineSyntax('~sub~')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'subscript' }], text: 'sub' }],
        },
      ],
    });
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
