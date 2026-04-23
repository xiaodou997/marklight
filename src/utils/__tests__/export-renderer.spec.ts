import { describe, expect, it } from 'vitest';
import { normalizeMarkdownForExport } from '../export-renderer';

describe('normalizeMarkdownForExport', () => {
  it('downgrades frontmatter to yaml code block', () => {
    const input = '---\ntitle: Hello\ntags:\n  - demo\n---\n\n# Title\n';
    expect(normalizeMarkdownForExport(input)).toBe('```yaml\ntitle: Hello\ntags:\n  - demo\n```\n\n# Title\n');
  });

  it('downgrades callout syntax to styled blockquote markdown', () => {
    const input = '> [!warning] Heads up\n> line 1\n> line 2\n';
    expect(normalizeMarkdownForExport(input)).toBe('> **WARNING: Heads up**\n>\n> line 1\n> line 2\n');
  });

  it('downgrades math and wikilinks predictably', () => {
    const input = '$inline$\n\n$$\na^2 + b^2 = c^2\n$$\n\n[[Page Name|Alias]]\n';
    expect(normalizeMarkdownForExport(input)).toBe(
      '`math: inline`\n\n```math\na^2 + b^2 = c^2\n```\n\n[Alias](wikilink://Page%20Name)\n',
    );
  });
});
