import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';

import { createMarkdownCompatSchema } from '../../markdown/compat-schema';
import { convertPendingHeading, revertEmptyHeading } from '../semantic-heading';

describe('convertPendingHeading', () => {
  it('converts a paragraph markdown heading with body text into a semantic heading', () => {
    const schema = createMarkdownCompatSchema();
    const state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, [schema.text('# Hello')]),
      ]),
    });

    const tr = convertPendingHeading(state.tr, state.doc, schema.nodes.heading);
    expect(tr).not.toBeNull();

    const nextState = state.apply(tr!);
    const heading = nextState.doc.firstChild;
    expect(heading?.type.name).toBe('heading');
    expect(heading?.attrs.level).toBe(1);
    expect(heading?.textContent).toBe('Hello');
  });

  it('reverts an empty heading back to paragraph with # prefix', () => {
    const schema = createMarkdownCompatSchema();
    const state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 1 }),
      ]),
    });

    const tr = revertEmptyHeading(state.tr, state.doc);
    expect(tr).not.toBeNull();

    const nextState = state.apply(tr!);
    const para = nextState.doc.firstChild;
    expect(para?.type.name).toBe('paragraph');
    expect(para?.textContent).toBe('# ');
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

  it('reverts an empty H2 heading with ## prefix', () => {
    const schema = createMarkdownCompatSchema();
    const state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [
        schema.nodes.heading.create({ level: 2 }),
      ]),
    });

    const tr = revertEmptyHeading(state.tr, state.doc);
    expect(tr).not.toBeNull();

    const nextState = state.apply(tr!);
    const para = nextState.doc.firstChild;
    expect(para?.type.name).toBe('paragraph');
    expect(para?.textContent).toBe('## ');
  });

  it('keeps an empty markdown heading prefix as a paragraph', () => {
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
