import type { Schema } from '@tiptap/pm/model';
import type Token from 'markdown-it/lib/token.mjs';
import type { MarkdownParseState, TokenHandler } from '../parser';
import type { NodeSerializer } from '../serializer';
import { frontmatterMarkdownPlugin } from './frontmatter';
import { mathMarkdownPlugin } from './math';
import { mermaidMarkdownPlugin } from './mermaid';
import { wikilinkMarkdownPlugin } from './wikilink';

export interface PreprocessContext {
  content: string;
}

export type PreprocessResult<T = unknown> = {
  content: string;
  data?: T;
};

export interface Preprocessor<T = unknown> {
  preprocess(context: PreprocessContext): PreprocessResult<T>;
  beforeParse?(state: MarkdownParseState, data: T): void;
}

export type FenceHandler = (
  state: MarkdownParseState,
  token: Token,
  language: string | null,
  content: string,
) => boolean;

export interface MarkdownSyntaxPlugin {
  name: string;
  preprocessor?: (schema: Schema) => Preprocessor | null;
  fenceHandler?: (schema: Schema) => FenceHandler | null;
  tokenHandlers?: (schema: Schema) => Record<string, TokenHandler>;
  nodeSerializers?: Record<string, NodeSerializer>;
}

export const markdownSyntaxPlugins = [
  frontmatterMarkdownPlugin,
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

export function getPluginPreprocessors(schema: Schema): Preprocessor[] {
  return markdownSyntaxPlugins.flatMap((plugin) => {
    const preprocessor = plugin.preprocessor?.(schema);
    return preprocessor ? [preprocessor] : [];
  });
}
