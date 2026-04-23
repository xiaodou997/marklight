import markdownit from 'markdown-it';
import markdownItTaskLists from 'markdown-it-task-lists';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import markdownItMark from 'markdown-it-mark';
import markdownItDeflist from 'markdown-it-deflist';
import markdownItAbbr from 'markdown-it-abbr';
import { WechatTheme, getThemeById } from './wechat-themes';

function normalizeFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n([\s\S]*?)\n---\n*/u, (_, body: string) => `\`\`\`yaml\n${body}\n\`\`\`\n\n`);
}

function normalizeMathBlocks(markdown: string): string {
  return markdown.replace(/^\$\$\n([\s\S]*?)\n\$\$\s*$/gmu, (_, body: string) => `\`\`\`math\n${body}\n\`\`\`\n`);
}

function normalizeCallouts(markdown: string): string {
  return markdown.replace(
    /^> \[!([^\]]+)\]\s*(.*)\n((?:>.*(?:\n|$))*)/gmu,
    (_, type: string, title: string, body: string) => {
      const label = type.trim().replace(/[-_]+/g, ' ').toUpperCase();
      const header = title.trim() ? `> **${label}: ${title.trim()}**` : `> **${label}**`;
      const normalizedBody = body
        .replace(/^>\s?/gmu, '')
        .replace(/\n$/u, '')
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');

      return normalizedBody ? `${header}\n>\n${normalizedBody}\n` : `${header}\n`;
    },
  );
}

function normalizeWikilinks(markdown: string): string {
  return markdown.replace(/\[\[([^[\]|]+?)(?:\|([^[\]]+))?\]\]/g, (_, target: string, alias?: string) => {
    const trimmedTarget = target.trim();
    const label = (alias ?? trimmedTarget).trim();
    return `[${label}](wikilink://${encodeURIComponent(trimmedTarget)})`;
  });
}

function normalizeInlineMath(markdown: string): string {
  return markdown.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, content: string) => `\`math: ${content.trim()}\``);
}

export function normalizeMarkdownForExport(markdown: string): string {
  const normalized = [
    normalizeFrontmatter,
    normalizeMathBlocks,
    normalizeCallouts,
    normalizeWikilinks,
    normalizeInlineMath,
  ].reduce((value, transform) => transform(value), markdown || '');

  return normalized.replace(/\n*$/u, '\n');
}

function getStyles(theme: WechatTheme) {
  return {
    h1: `font-size: 24px; font-weight: bold; color: ${theme.colors.primary}; border-bottom: 2px solid ${theme.colors.primary}; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px;`,
    h2: `font-size: 20px; font-weight: bold; color: ${theme.colors.primaryDark}; border-left: 4px solid ${theme.colors.primaryDark}; padding-left: 10px; margin-top: 25px; margin-bottom: 12px;`,
    h3: `font-size: 18px; font-weight: bold; color: ${theme.colors.primaryLight}; margin-top: 20px; margin-bottom: 10px;`,
    h4: `font-size: 17px; font-weight: bold; color: ${theme.colors.primaryLight}; margin-top: 18px; margin-bottom: 8px;`,
    h5: `font-size: 16px; font-weight: bold; color: ${theme.colors.primaryLight}; margin-top: 16px; margin-bottom: 8px;`,
    h6: `font-size: 15px; font-weight: bold; color: ${theme.colors.textMuted}; margin-top: 14px; margin-bottom: 6px;`,
    p: `font-size: 16px; color: ${theme.colors.text}; line-height: 1.75; margin-bottom: 1.2em; text-align: justify;`,
    blockquote: `border-left: 4px solid ${theme.colors.blockquoteBorder}; padding: 10px 20px; background-color: ${theme.colors.blockquoteBg}; color: ${theme.colors.textMuted}; margin: 1.5em 0;`,
    code: `background-color: ${theme.colors.codeBg}; color: ${theme.colors.codeColor}; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 14px;`,
    pre: `background-color: ${theme.colors.preBg}; color: ${theme.colors.preColor}; padding: 15px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 14px; line-height: 1.5; margin: 1.5em 0;`,
    strong: `font-weight: bold; color: ${theme.colors.primary};`,
    em: `font-style: italic;`,
    ul: `margin-bottom: 1.2em; padding-left: 20px; list-style-type: disc;`,
    ol: `margin-bottom: 1.2em; padding-left: 20px; list-style-type: decimal;`,
    li: `margin-bottom: 0.5em; line-height: 1.6;`,
    table: `border-collapse: collapse; width: 100%; margin: 1.5em 0; border: 1px solid ${theme.colors.tableBorder};`,
    th: `background-color: ${theme.colors.tableHeaderBg}; border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px; font-weight: bold;`,
    td: `border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px;`,
  };
}

let markdownRenderer: ReturnType<typeof markdownit> | null = null;

function getMarkdownRenderer() {
  if (!markdownRenderer) {
    markdownRenderer = markdownit({
      html: false,
      linkify: true,
      typographer: true,
    })
      .enable('table')
      .enable('strikethrough')
      .use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true })
      .use(markdownItFootnote)
      .use(markdownItSub)
      .use(markdownItSup)
      .use(markdownItMark)
      .use(markdownItDeflist)
      .use(markdownItAbbr);
  }

  return markdownRenderer;
}

function withStyle(el: HTMLElement, style: string) {
  const prev = el.getAttribute('style');
  el.setAttribute('style', prev ? `${prev}; ${style}` : style);
}

function styleRenderedMarkdown(container: HTMLElement, theme: WechatTheme) {
  const styles = getStyles(theme);

  container.querySelectorAll('h1').forEach((el) => withStyle(el as HTMLElement, styles.h1));
  container.querySelectorAll('h2').forEach((el) => withStyle(el as HTMLElement, styles.h2));
  container.querySelectorAll('h3').forEach((el) => withStyle(el as HTMLElement, styles.h3));
  container.querySelectorAll('h4').forEach((el) => withStyle(el as HTMLElement, styles.h4));
  container.querySelectorAll('h5').forEach((el) => withStyle(el as HTMLElement, styles.h5));
  container.querySelectorAll('h6').forEach((el) => withStyle(el as HTMLElement, styles.h6));
  container.querySelectorAll('p').forEach((el) => withStyle(el as HTMLElement, styles.p));
  container.querySelectorAll('blockquote').forEach((el) => withStyle(el as HTMLElement, styles.blockquote));
  container.querySelectorAll('ul').forEach((el) => withStyle(el as HTMLElement, styles.ul));
  container.querySelectorAll('ol').forEach((el) => withStyle(el as HTMLElement, styles.ol));
  container.querySelectorAll('li').forEach((el) => withStyle(el as HTMLElement, styles.li));
  container.querySelectorAll('strong').forEach((el) => withStyle(el as HTMLElement, styles.strong));
  container.querySelectorAll('em').forEach((el) => withStyle(el as HTMLElement, styles.em));
  container.querySelectorAll('mark').forEach((el) =>
    withStyle(el as HTMLElement, 'background-color: #fef08a; padding: 1px 2px; border-radius: 2px;'),
  );
  container.querySelectorAll('sub').forEach((el) =>
    withStyle(el as HTMLElement, 'font-size: 0.75em; vertical-align: sub;'),
  );
  container.querySelectorAll('sup').forEach((el) =>
    withStyle(el as HTMLElement, 'font-size: 0.75em; vertical-align: super;'),
  );
  container.querySelectorAll('a').forEach((el) =>
    withStyle(el as HTMLElement, `color: ${theme.colors.primary}; text-decoration: underline;`),
  );
  container.querySelectorAll('img').forEach((el) =>
    withStyle(el as HTMLElement, 'max-width: 100%; border-radius: 8px; margin: 1em 0;'),
  );
  container.querySelectorAll('hr').forEach((el) =>
    withStyle(el as HTMLElement, `border: 0; border-top: 1px solid ${theme.colors.tableBorder}; margin: 1.5em 0;`),
  );

  container.querySelectorAll('pre').forEach((el) => {
    withStyle(el as HTMLElement, styles.pre);
    const code = el.querySelector('code');
    if (code) {
      withStyle(code as HTMLElement, 'background: transparent; color: inherit; padding: 0; border-radius: 0;');
    }
  });
  container.querySelectorAll('code').forEach((el) => {
    if (el.closest('pre')) {
      return;
    }
    withStyle(el as HTMLElement, styles.code);
  });

  container.querySelectorAll('table').forEach((el) => withStyle(el as HTMLElement, styles.table));
  container.querySelectorAll('th').forEach((el) => withStyle(el as HTMLElement, styles.th));
  container.querySelectorAll('td').forEach((el) => withStyle(el as HTMLElement, styles.td));

  container.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    const input = el as HTMLInputElement;
    input.disabled = true;
    withStyle(input, `margin-right: 8px; transform: scale(1.05); accent-color: ${theme.colors.primary};`);
  });
}

export async function renderMarkdownToExportHtml(markdown: string, themeId: string = 'blue'): Promise<string> {
  const theme = getThemeById(themeId);
  const renderer = getMarkdownRenderer();
  const normalized = normalizeMarkdownForExport(markdown);
  const html = renderer.render(normalized);

  if (typeof document === 'undefined') {
    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px;">${html}</div>`;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  styleRenderedMarkdown(wrapper, theme);

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px;">${wrapper.innerHTML}</div>`;
}
