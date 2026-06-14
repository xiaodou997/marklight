// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { Slice } from '@tiptap/pm/model';
import type { Node as PMNode } from '@tiptap/pm/model';

import { createMarkdownCompatSchema } from '../../markdown/compat-schema';
import {
  looksLikeMarkdownTable,
  markdownPastePlugin,
  parseMarkdownTablePaste,
} from '../markdown-paste';

describe('looksLikeMarkdownTable', () => {
  it('recognizes a standard GFM table', () => {
    expect(looksLikeMarkdownTable('| A | B |\n| --- | --- |\n| 1 | 2 |')).toBe(true);
  });

  it('recognizes alignment separators', () => {
    expect(looksLikeMarkdownTable('| A | B | C |\n|:---|:---:|---:|\n| 1 | 2 | 3 |')).toBe(true);
  });

  it('recognizes a table without leading/trailing pipes', () => {
    expect(looksLikeMarkdownTable('A | B\n--- | ---\n1 | 2')).toBe(true);
  });

  it('recognizes a single-column table', () => {
    expect(looksLikeMarkdownTable('| A |\n| --- |\n| 1 |')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(looksLikeMarkdownTable('hello world')).toBe(false);
    expect(looksLikeMarkdownTable('a | b but no separator row')).toBe(false);
  });

  it('rejects a single line', () => {
    expect(looksLikeMarkdownTable('| A | B |')).toBe(false);
  });

  it('rejects when the second line is not a separator', () => {
    expect(looksLikeMarkdownTable('| A | B |\n| 1 | 2 |')).toBe(false);
  });

  it('rejects prose that merely contains pipes', () => {
    expect(looksLikeMarkdownTable('use a | b in shell\nthen pipe to grep')).toBe(false);
  });
});

describe('parseMarkdownTablePaste', () => {
  const schema = createMarkdownCompatSchema();

  it('parses a GFM table into an insertable slice containing a table node', () => {
    const slice = parseMarkdownTablePaste(schema, '| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(slice).not.toBeNull();

    let hasTable = false;
    let rowCount = 0;
    slice!.content.descendants((node) => {
      if (node.type.name === 'table') hasTable = true;
      if (node.type.name === 'tableRow') rowCount += 1;
      return true;
    });
    expect(hasTable).toBe(true);
    // 表头行 + 一行数据 = 2 行。
    expect(rowCount).toBe(2);
  });

  it('returns null for non-table text', () => {
    expect(parseMarkdownTablePaste(schema, 'just a paragraph')).toBeNull();
  });

  it('returns null for an incomplete table (no separator row)', () => {
    expect(parseMarkdownTablePaste(schema, '| A | B |\n| 1 | 2 |')).toBeNull();
  });
});

describe('markdownPastePlugin handlePaste（真实 EditorView 端到端）', () => {
  const schema = createMarkdownCompatSchema();
  let view: EditorView | null = null;
  let mount: HTMLElement | null = null;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });
  afterEach(() => {
    if (view && !view.isDestroyed) view.destroy();
    view = null;
    if (mount) mount.remove();
    mount = null;
  });

  function mountEmpty(): EditorView {
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    const state = EditorState.create({
      schema,
      doc,
      selection: TextSelection.create(doc, 1),
      plugins: [markdownPastePlugin()],
    });
    view = new EditorView(mount!, { state });
    return view;
  }

  // 仅模拟 handlePaste 实际读取的 clipboardData.getData；用 ProseMirror 自己的
  // someProp 分发，等价于真实粘贴时引擎调用 handlePaste 的路径。
  function pasteEvent(parts: Record<string, string>): ClipboardEvent {
    return {
      clipboardData: { getData: (type: string) => parts[type] ?? '' },
    } as unknown as ClipboardEvent;
  }

  function firePaste(v: EditorView, event: ClipboardEvent): boolean {
    return Boolean(
      v.someProp('handlePaste', (handler) => handler(v, event, Slice.empty)),
    );
  }

  function tableIn(doc: PMNode): PMNode | null {
    let found: PMNode | null = null;
    doc.descendants((node) => {
      if (node.type.name === 'table') found = node;
      return !found;
    });
    return found;
  }

  it('粘贴 GFM 表格文本 → 插入真实表格节点', () => {
    const v = mountEmpty();
    const handled = firePaste(
      v,
      pasteEvent({ 'text/plain': '| A | B |\n| --- | --- |\n| 1 | 2 |' }),
    );

    expect(handled).toBe(true);
    const table = tableIn(v.state.doc);
    expect(table).not.toBeNull();
    expect(table!.textContent).toContain('A');
    expect(table!.textContent).toContain('2');
  });

  it('粘贴普通文本 → 不拦截（走默认粘贴）', () => {
    const v = mountEmpty();
    const handled = firePaste(v, pasteEvent({ 'text/plain': 'just a paragraph' }));

    expect(handled).toBe(false);
    expect(tableIn(v.state.doc)).toBeNull();
  });

  it('剪贴板带富文本 <table> → 放行默认 HTML 粘贴', () => {
    const v = mountEmpty();
    const handled = firePaste(
      v,
      pasteEvent({
        'text/plain': '| A | B |\n| --- | --- |\n| 1 | 2 |',
        'text/html': '<table><tr><td>A</td><td>B</td></tr></table>',
      }),
    );

    expect(handled).toBe(false);
    expect(tableIn(v.state.doc)).toBeNull();
  });
});
