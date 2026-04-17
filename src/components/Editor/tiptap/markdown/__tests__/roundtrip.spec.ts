/**
 * Markdown ↔ PM Doc round-trip 测试
 *
 * 验证：md → parseMarkdown → serializeMarkdown → md'，md' === md
 * 这些测试不依赖 DOM/Editor（纯 schema + parser + serializer）。
 */
import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { parseMarkdown } from '../parser';
import { serializeMarkdown } from '../serializer';

// ── 构建最小可用 schema（模拟 TipTap StarterKit 的核心 nodes + marks） ──

function createTestSchema(): Schema {
  return new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
      heading: {
        group: 'block',
        content: 'headingMarker? inline*',
        attrs: { level: { default: 1 } },
        defining: true,
        parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
        toDOM: (node: any) => [`h${node.attrs.level}`, 0],
      },
      headingMarker: {
        inline: true,
        atom: true,
        selectable: true,
        attrs: { level: { default: 1 } },
        parseDOM: [{ tag: 'span[data-heading-marker]' }],
        toDOM: (node: any) => ['span', { 'data-heading-marker': '', 'data-level': node.attrs.level }, '#'.repeat(node.attrs.level) + ' '],
      },
      blockquote: { group: 'block', content: 'block+', parseDOM: [{ tag: 'blockquote' }], toDOM: () => ['blockquote', 0] },
      bulletList: { group: 'block', content: 'listItem+', parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
      orderedList: { group: 'block', content: 'listItem+', attrs: { start: { default: 1 } }, parseDOM: [{ tag: 'ol' }], toDOM: () => ['ol', 0] },
      listItem: { content: 'block+', parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
      codeBlock: {
        group: 'block', content: 'text*', marks: '', code: true,
        attrs: { language: { default: null } },
        parseDOM: [{ tag: 'pre' }], toDOM: () => ['pre', ['code', 0]],
      },
      hardBreak: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
      horizontalRule: { group: 'block', parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
      image: {
        inline: false, group: 'block',
        attrs: { src: { default: '' }, alt: { default: '' }, title: { default: null } },
        parseDOM: [{ tag: 'img' }], toDOM: () => ['img'],
      },
      text: { group: 'inline' },
      // mark tokens (Phase A)
      boldOpen: { inline: true, group: 'inline', atom: true, selectable: false, toDOM: () => ['span', {}, '**'] },
      boldClose: { inline: true, group: 'inline', atom: true, selectable: false, toDOM: () => ['span', {}, '**'] },
      italicOpen: { inline: true, group: 'inline', atom: true, selectable: false, toDOM: () => ['span', {}, '*'] },
      italicClose: { inline: true, group: 'inline', atom: true, selectable: false, toDOM: () => ['span', {}, '*'] },
      strikeOpen: { inline: true, group: 'inline', atom: true, selectable: false, toDOM: () => ['span', {}, '~~'] },
      strikeClose: { inline: true, group: 'inline', atom: true, selectable: false, toDOM: () => ['span', {}, '~~'] },
    },
    marks: {
      bold: { parseDOM: [{ tag: 'strong' }], toDOM: () => ['strong', 0] },
      italic: { parseDOM: [{ tag: 'em' }], toDOM: () => ['em', 0] },
      strike: { parseDOM: [{ tag: 's' }], toDOM: () => ['s', 0] },
      code: { parseDOM: [{ tag: 'code' }], toDOM: () => ['code', 0] },
      highlight: { parseDOM: [{ tag: 'mark' }], toDOM: () => ['mark', 0] },
      link: {
        attrs: { href: { default: '' }, target: { default: null }, title: { default: null } },
        parseDOM: [{ tag: 'a' }],
        toDOM: () => ['a', 0],
      },
      superscript: { parseDOM: [{ tag: 'sup' }], toDOM: () => ['sup', 0] },
      subscript: { parseDOM: [{ tag: 'sub' }], toDOM: () => ['sub', 0] },
    },
  });
}

function roundTrip(md: string): string {
  const schema = createTestSchema();
  const doc = parseMarkdown(schema, md);
  return serializeMarkdown(doc);
}

function normalize(md: string): string {
  return md.replace(/\n+$/, '\n');
}

// ── 基础 round-trip 测试 ─────────────────────────────────────

describe('Round-trip: parse → serialize', () => {
  describe('Phase A: bold / italic / strike', () => {
    it('bold', () => {
      expect(roundTrip('**hello**\n')).toBe(normalize('**hello**\n'));
    });

    it('italic', () => {
      expect(roundTrip('*hello*\n')).toBe(normalize('*hello*\n'));
    });

    it('strike', () => {
      expect(roundTrip('~~hello~~\n')).toBe(normalize('~~hello~~\n'));
    });

    it('nested bold + italic', () => {
      expect(roundTrip('**a *b* c**\n')).toBe(normalize('**a *b* c**\n'));
    });

    it('nested strike + bold (mark order normalized by PM schema)', () => {
      // PM 按 schema 定义顺序排列同范围 mark：bold 在 strike 外层
      expect(roundTrip('~~**hello**~~\n')).toBe(normalize('**~~hello~~**\n'));
    });

    it('multiple marks in sequence', () => {
      expect(roundTrip('**bold** then *italic* then ~~strike~~\n'))
        .toBe(normalize('**bold** then *italic* then ~~strike~~\n'));
    });
  });

  describe('headings', () => {
    it('heading with marker', () => {
      expect(roundTrip('## Hello\n')).toBe(normalize('## Hello\n'));
    });

    it('heading with bold', () => {
      expect(roundTrip('## **Bold heading**\n')).toBe(normalize('## **Bold heading**\n'));
    });
  });

  describe('other marks', () => {
    it('inline code', () => {
      expect(roundTrip('`code`\n')).toBe(normalize('`code`\n'));
    });

    it('highlight', () => {
      expect(roundTrip('==highlight==\n')).toBe(normalize('==highlight==\n'));
    });

    it('link', () => {
      expect(roundTrip('[text](https://example.com)\n'))
        .toBe(normalize('[text](https://example.com)\n'));
    });

    it('superscript', () => {
      expect(roundTrip('^sup^\n')).toBe(normalize('^sup^\n'));
    });

    it('subscript', () => {
      expect(roundTrip('~sub~\n')).toBe(normalize('~sub~\n'));
    });
  });

  describe('block contexts', () => {
    it('bold in list item', () => {
      expect(roundTrip('- **bold item**\n')).toBe(normalize('- **bold item**\n'));
    });

    it('bold in blockquote', () => {
      expect(roundTrip('> **bold quote**\n')).toBe(normalize('> **bold quote**\n'));
    });

    it('plain paragraph', () => {
      expect(roundTrip('hello world\n')).toBe(normalize('hello world\n'));
    });

    it('horizontal rule', () => {
      expect(roundTrip('---\n')).toBe(normalize('---\n'));
    });
  });

  describe('edge cases', () => {
    it('empty document', () => {
      const result = roundTrip('');
      expect(result.trim()).toBe('');
    });

    it('multiple paragraphs', () => {
      const md = 'first\n\nsecond\n';
      expect(roundTrip(md)).toBe(normalize(md));
    });
  });
});
