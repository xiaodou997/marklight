import { describe, expect, it } from 'vitest';
import Token from 'markdown-it/lib/token.mjs';
import { createMarkdownCompatSchema } from '../compat-schema';
import { MarkdownParseState } from '../parser';
import {
  getPluginFenceHandlers,
  getPluginNodeSerializers,
  getPluginPreprocessors,
  getPluginTokenHandlers,
  getPluginTokenInterceptors,
  markdownSyntaxPlugins,
} from '../plugins';

describe('markdown syntax plugin registry', () => {
  const schema = createMarkdownCompatSchema();

  it('keeps feature plugins registered in preprocessing order', () => {
    expect(markdownSyntaxPlugins.map((plugin) => plugin.name)).toEqual([
      'frontmatter',
      'callout',
      'math',
      'mermaid',
      'wikilink',
    ]);
  });

  it('aggregates parser and serializer hooks from plugins', () => {
    expect(getPluginPreprocessors(schema).map((preprocessor) => preprocessor.name)).toEqual([
      'frontmatter',
      'callout',
    ]);
    expect(getPluginFenceHandlers(schema)).toHaveLength(1);
    expect(getPluginTokenInterceptors(schema)).toHaveLength(1);
    expect(Object.keys(getPluginTokenHandlers(schema)).sort()).toEqual([
      'math_block',
      'math_inline',
      'text',
    ]);
    expect(Object.keys(getPluginNodeSerializers()).sort()).toEqual([
      'callout',
      'frontmatter',
      'mathBlock',
      'mathInline',
      'mermaidBlock',
      'wikilink',
    ]);
  });

  it('extracts frontmatter before markdown-it tokenization', () => {
    const [frontmatter] = getPluginPreprocessors(schema);
    const result = frontmatter.preprocess({
      content: '---\ntitle: Demo\n---\n# Body\n',
    });
    const state = new MarkdownParseState(schema);

    frontmatter.beforeParse?.(state, result.data);

    expect(result.content).toBe('# Body\n');
    expect(state.top.content[0]?.type.name).toBe('frontmatter');
    expect(state.top.content[0]?.textContent).toBe('title: Demo');
  });

  it('turns callout placeholders into callout nodes through interceptors', () => {
    const callout = getPluginPreprocessors(schema).find((item) => item.name === 'callout');
    const interceptor = getPluginTokenInterceptors(schema)[0];
    const result = callout!.preprocess({
      content: '> [!tip] Heads up\n> Body text\n',
    });
    const state = new MarkdownParseState(schema, {
      callout: result.data,
    });
    const token = new Token('html_block', '', 0);
    token.content = '<!--CALLOUT_BLOCK_0-->';

    expect(result.content).toContain('<!--CALLOUT_BLOCK_0-->');
    expect(interceptor(state, token, [token], 0)).toBe(true);
    expect(state.top.content[0]?.type.name).toBe('callout');
    expect(state.top.content[0]?.attrs.type).toBe('tip');
    expect(state.top.content[0]?.attrs.title).toBe('Heads up');
    expect(state.top.content[0]?.textContent).toBe('Body text');
  });

  it('routes mermaid fences through the plugin fence handler', () => {
    const [fenceHandler] = getPluginFenceHandlers(schema);
    const state = new MarkdownParseState(schema);
    const token = new Token('fence', 'code', 0);

    expect(fenceHandler(state, token, 'mermaid', 'graph TD;\nA-->B')).toBe(true);
    expect(state.top.content[0]?.type.name).toBe('mermaidBlock');
    expect(state.top.content[0]?.textContent).toBe('graph TD;\nA-->B');
  });

  it('omits schema-specific hooks when nodes are unavailable', () => {
    const minimalSchema = createMarkdownCompatSchema();
    const calloutNode = minimalSchema.nodes.callout;

    delete (minimalSchema.nodes as Record<string, unknown>).callout;

    expect(getPluginPreprocessors(minimalSchema).map((item) => item.name)).toEqual([
      'frontmatter',
    ]);
    expect(getPluginTokenInterceptors(minimalSchema)).toHaveLength(0);

    (minimalSchema.nodes as Record<string, unknown>).callout = calloutNode;
  });
});
