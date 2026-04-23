import { renderMarkdownToWechatFragment } from './export';

/**
 * 兼容旧微信导出入口。
 * 新实现已统一到基于 PM 文档语义树的 export renderer。
 */
export async function renderMarkdownToWechatHtml(
  markdown: string,
  themeId: string = 'blue',
): Promise<string> {
  return renderMarkdownToWechatFragment(markdown, themeId).html;
}
