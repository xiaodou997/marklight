import type { Schema } from '@tiptap/pm/model';
import type { TokenHandler } from '../parser';
import type { NodeSerializer } from '../serializer';
import { mathMarkdownPlugin } from './math';
import { wikilinkMarkdownPlugin } from './wikilink';

export interface MarkdownSyntaxPlugin {
  name: string;
  tokenHandlers?: (schema: Schema) => Record<string, TokenHandler>;
  nodeSerializers?: Record<string, NodeSerializer>;
}

export const markdownSyntaxPlugins = [
  mathMarkdownPlugin,
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
