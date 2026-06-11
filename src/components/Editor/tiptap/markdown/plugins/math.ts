import type Token from 'markdown-it/lib/token.mjs';
import type { Schema } from '@tiptap/pm/model';
import type { MarkdownParseState, TokenHandler } from '../parser';
import type { MarkdownSerializerState, NodeSerializer } from '../serializer';
import type { MarkdownSyntaxPlugin } from './index';

export function mathTokenHandlers(schema: Schema): Record<string, TokenHandler> {
  const handlers: Record<string, TokenHandler> = {};

  if (schema.nodes.mathInline) {
    handlers.math_inline = (state: MarkdownParseState, token: Token) => {
      state.addNode(schema.nodes.mathInline, { latex: token.content.trim() });
    };
  }

  if (schema.nodes.mathBlock) {
    handlers.math_block = (state: MarkdownParseState, token: Token) => {
      const latex = token.content.replace(/^\n|\n$/g, '');
      state.addNode(schema.nodes.mathBlock, {}, latex ? [schema.text(latex)] : undefined);
    };
  }

  return handlers;
}

export const mathNodeSerializers: Record<string, NodeSerializer> = {
  mathInline(state: MarkdownSerializerState, node) {
    state.write(`$${node.attrs.latex || ''}$`);
  },

  mathBlock(state: MarkdownSerializerState, node) {
    state.writeLine('$$');
    state.writeLine(node.textContent);
    state.writeLine('$$');
    state.closeBlock(node);
  },
};

export const mathMarkdownPlugin: MarkdownSyntaxPlugin = {
  name: 'math',
  tokenHandlers: mathTokenHandlers,
  nodeSerializers: mathNodeSerializers,
};
