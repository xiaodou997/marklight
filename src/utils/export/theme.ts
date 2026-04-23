import { getThemeById } from '../wechat-themes';
import type { ExportThemeTokens } from './model';

export function getExportThemeTokens(themeId: string = 'blue'): ExportThemeTokens {
  const theme = getThemeById(themeId);

  return {
    accent: theme.colors.primary,
    accentStrong: theme.colors.primaryDark,
    accentSoft: theme.colors.primaryLight,
    text: theme.colors.text,
    textMuted: theme.colors.textMuted,
    border: theme.colors.tableBorder,
    surface: '#ffffff',
    surfaceMuted: theme.colors.blockquoteBg,
    codeBackground: theme.colors.codeBg,
    codeForeground: theme.colors.codeColor,
    preBackground: theme.colors.preBg,
    preForeground: theme.colors.preColor,
  };
}
