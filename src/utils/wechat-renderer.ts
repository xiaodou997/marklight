import { renderMarkdownToExportHtml } from './export-renderer';

/**
 * 兼容旧导出入口。
 * 实际实现已统一到 export-renderer contract，避免再维护一套旁路逻辑。
 */
export async function renderMarkdownToWechatHtml(
  markdown: string,
  themeId: string = 'blue',
): Promise<string> {
  return renderMarkdownToExportHtml(markdown, themeId);
}
