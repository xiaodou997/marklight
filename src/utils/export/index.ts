import type { Node as PMNode } from '@tiptap/pm/model';
import { createMarkdownCompatSchema } from '../../components/Editor/tiptap/markdown/compat-schema';
import { parseMarkdown } from '../../components/Editor/tiptap/markdown/parser';
import { buildExportTree } from './build-export-tree';
import type { ExportDocument, ExportRenderOptions, WechatRenderResult } from './model';
import { renderHtmlDocument } from './renderers/html';
import { renderWechatFragment } from './renderers/wechat';

export { buildExportTree } from './build-export-tree';
export type * from './model';

export function renderExportDocument(doc: PMNode): ExportDocument {
  return buildExportTree(doc);
}

export async function renderEditorDocToHtmlDocument(
  doc: PMNode,
  options: ExportRenderOptions = {},
): Promise<string> {
  return renderHtmlDocument(buildExportTree(doc), options);
}

export function renderEditorDocToWechatFragment(
  doc: PMNode,
  options: ExportRenderOptions = {},
): WechatRenderResult {
  return renderWechatFragment(buildExportTree(doc), options);
}

export async function renderMarkdownToExportHtml(
  markdown: string,
  themeId: string = 'blue',
): Promise<string> {
  const schema = createMarkdownCompatSchema();
  const doc = parseMarkdown(schema, markdown);
  return renderEditorDocToHtmlDocument(doc, { themeId });
}

export function renderMarkdownToWechatFragment(
  markdown: string,
  themeId: string = 'blue',
): WechatRenderResult {
  const schema = createMarkdownCompatSchema();
  const doc = parseMarkdown(schema, markdown);
  return renderEditorDocToWechatFragment(doc, { themeId });
}
