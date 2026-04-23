import { describe, expect, it } from 'vitest';
import { formatImageMarkdown, parseImageMarkdown } from '../image';

describe('formatImageMarkdown', () => {
  it('formats image markdown without title', () => {
    expect(formatImageMarkdown({ src: '/demo.png', alt: 'demo', title: null }))
      .toBe('![demo](/demo.png)');
  });

  it('formats image markdown with title', () => {
    expect(formatImageMarkdown({ src: '/demo.png', alt: 'demo', title: 'cover' }))
      .toBe('![demo](/demo.png "cover")');
  });
});

describe('parseImageMarkdown', () => {
  it('parses image markdown without title', () => {
    expect(parseImageMarkdown('![demo](/demo.png)')).toEqual({
      src: '/demo.png',
      alt: 'demo',
      title: null,
    });
  });

  it('parses image markdown with title', () => {
    expect(parseImageMarkdown('![demo](/demo.png "cover")')).toEqual({
      src: '/demo.png',
      alt: 'demo',
      title: 'cover',
    });
  });

  it('returns null for invalid markdown', () => {
    expect(parseImageMarkdown('not image markdown')).toBe(null);
    expect(parseImageMarkdown('![]()')).toBe(null);
  });
});
