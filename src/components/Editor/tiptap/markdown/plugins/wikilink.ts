import type { Schema } from '@tiptap/pm/model';
import type { MarkdownParseState, TokenHandler } from '../parser';
import type { MarkdownSerializerState, NodeSerializer } from '../serializer';
import type { MarkdownSyntaxPlugin } from './index';

function parseWikilinkText(state: MarkdownParseState, content: string) {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      state.addText(content.slice(lastIndex, match.index));
    }

    const target = match[1].trim();
    const alias = match[2]?.trim() || '';
    state.addNode(state.schema.nodes.wikilink, { target, alias });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    state.addText(content.slice(lastIndex));
  }
}

export function wikilinkTokenHandlers(schema: Schema): Record<string, TokenHandler> {
  if (!schema.nodes.wikilink) {
    return {};
  }

  return {
    text(state, token) {
      if (/\[\[/.test(token.content)) {
        parseWikilinkText(state, token.content);
      } else {
        state.addText(token.content);
      }
    },
  };
}

export const wikilinkNodeSerializers: Record<string, NodeSerializer> = {
  wikilink(state: MarkdownSerializerState, node) {
    const target = node.attrs.target as string;
    const alias = node.attrs.alias as string;
    if (alias) {
      state.write(`[[${target}|${alias}]]`);
    } else {
      state.write(`[[${target}]]`);
    }
  },
};

export const wikilinkMarkdownPlugin: MarkdownSyntaxPlugin = {
  name: 'wikilink',
  tokenHandlers: wikilinkTokenHandlers,
  nodeSerializers: wikilinkNodeSerializers,
};
