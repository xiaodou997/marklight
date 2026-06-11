import type { Schema } from '@tiptap/pm/model';
import type Token from 'markdown-it/lib/token.mjs';
import type { MarkdownParseState, TokenHandler } from '../parser';
import type { NodeSerializer } from '../serializer';
import { mathMarkdownPlugin } from './math';
import { mermaidMarkdownPlugin } from './mermaid';
import { wikilinkMarkdownPlugin } from './wikilink';

export type FenceHandler = (
  state: MarkdownParseState,
  token: Token,
  language: string | null,
  content: string,
) => boolean;

export interface MarkdownSyntaxPlugin {
  name: string;
  fenceHandler?: (schema: Schema) => FenceHandler | null;
  tokenHandlers?: (schema: Schema) => Record<string, TokenHandler>;
  nodeSerializers?: Record<string, NodeSerializer>;
}

export const markdownSyntaxPlugins = [
  mathMarkdownPlugin,
  mermaidMarkdownPlugin,
  wikilinkMarkdownPlugin,
] satisfies MarkdownSyntaxPlugin[];

export function getPluginTokenHandlers(schema: Schema): Record<string, TokenHandler> {
  return Object.assign(
    {},
    ...markdownSyntaxPlugins.map((plugin) => plugin.tokenHandlers?.(schema) ?? {}),
  );
}

export function getPluginNodeSerializers(): Record<string, NodeSerializer> {
  return Object.assign(
    {},
    ...markdownSyntaxPlugins.map((plugin) => plugin.nodeSerializers ?? {}),
  );
}

export function getPluginFenceHandlers(schema: Schema): FenceHandler[] {
  return markdownSyntaxPlugins.flatMap((plugin) => {
    const handler = plugin.fenceHandler?.(schema);
    return handler ? [handler] : [];
  });
}
