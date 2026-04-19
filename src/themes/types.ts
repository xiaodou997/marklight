/**
 * 主题类型定义
 *
 * 定义主题的颜色变量结构和相关类型
 */

/** 主题 ID */
export type ThemeId = string;

/** 主题类型 */
export type ThemeType = 'preset' | 'custom';

/** 主题元数据 */
export interface ThemeMeta {
  /** 主题唯一标识 */
  id: ThemeId;
  /** 主题名称 */
  name: string;
  /** 主题类型 */
  type: ThemeType;
  /** 作者 */
  author?: string;
  /** 描述 */
  description?: string;
  /** 版本 */
  version?: string;
}

/** 主题颜色配置 */
export interface ThemeColors {
  // 主色调
  primaryColor: string;
  primaryHover: string;
  primaryLight: string;

  // 背景
  bgColor: string;
  bgSecondary: string;

  // 文字
  textColor: string;
  textSecondary: string;
  mutedColor: string;

  // 边框
  borderColor: string;
  borderLight: string;

  // 侧边栏
  sidebarBg: string;
  sidebarHover: string;

  // 代码
  codeBg: string;
  codeBorder: string;

  // 交互状态
  hoverBg: string;
  activeBg: string;
  selectedBg: string;

  // 引用 & 标签
  quoteBg: string;
  tagBg: string;
  tagColor: string;

  // 状态颜色
  successColor: string;
  successBg: string;
  warningColor: string;
  warningBg: string;
  errorColor: string;
  errorBg: string;
  infoColor: string;
  infoBg: string;

  // 阴影
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowXl: string;

  // 圆角
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;

  // 弹窗
  modalBg: string;
  modalBorder: string;
  modalOverlay: string;
  modalShadow: string;

  // 输入框
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
  inputFocusShadow: string;
  inputPlaceholder: string;

  // 按钮
  btnPrimaryBg: string;
  btnPrimaryHover: string;
  btnPrimaryText: string;
  btnSecondaryBg: string;
  btnSecondaryHover: string;
  btnSecondaryText: string;
  btnGhostBg: string;
  btnGhostHover: string;

  // 浮动菜单
  popoverBg: string;
  popoverBorder: string;
  popoverShadow: string;

  // Callout
  calloutNote: string;
  calloutNoteBg: string;
  calloutTip: string;
  calloutTipBg: string;
  calloutWarning: string;
  calloutWarningBg: string;
  calloutDanger: string;
  calloutDangerBg: string;
  calloutSuccess: string;
  calloutSuccessBg: string;
  calloutQuote: string;
  calloutQuoteBg: string;
}

/** 完整主题定义 */
export interface Theme extends ThemeMeta {
  /** 浅色模式颜色 */
  light: ThemeColors;
  /** 深色模式颜色 */
  dark: ThemeColors;
}

/** 主题切换模式 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 主题管理状态 */
export interface ThemeState {
  /** 当前主题 ID */
  activeThemeId: ThemeId;
  /** 主题模式 */
  themeMode: ThemeMode;
  /** 自定义主题列表 */
  customThemes: Theme[];
}

/** CSS 变量映射 */
export const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  primaryColor: '--primary-color',
  primaryHover: '--primary-hover',
  primaryLight: '--primary-light',
  bgColor: '--bg-color',
  bgSecondary: '--bg-secondary',
  textColor: '--text-color',
  textSecondary: '--text-secondary',
  mutedColor: '--muted-color',
  borderColor: '--border-color',
  borderLight: '--border-light',
  sidebarBg: '--sidebar-bg',
  sidebarHover: '--sidebar-hover',
  codeBg: '--code-bg',
  codeBorder: '--code-border',
  hoverBg: '--hover-bg',
  activeBg: '--active-bg',
  selectedBg: '--selected-bg',
  quoteBg: '--quote-bg',
  tagBg: '--tag-bg',
  tagColor: '--tag-color',
  successColor: '--success-color',
  successBg: '--success-bg',
  warningColor: '--warning-color',
  warningBg: '--warning-bg',
  errorColor: '--error-color',
  errorBg: '--error-bg',
  infoColor: '--info-color',
  infoBg: '--info-bg',
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
  shadowXl: '--shadow-xl',
  radiusSm: '--radius-sm',
  radiusMd: '--radius-md',
  radiusLg: '--radius-lg',
  radiusXl: '--radius-xl',
  modalBg: '--modal-bg',
  modalBorder: '--modal-border',
  modalOverlay: '--modal-overlay',
  modalShadow: '--modal-shadow',
  inputBg: '--input-bg',
  inputBorder: '--input-border',
  inputFocusBorder: '--input-focus-border',
  inputFocusShadow: '--input-focus-shadow',
  inputPlaceholder: '--input-placeholder',
  btnPrimaryBg: '--btn-primary-bg',
  btnPrimaryHover: '--btn-primary-hover',
  btnPrimaryText: '--btn-primary-text',
  btnSecondaryBg: '--btn-secondary-bg',
  btnSecondaryHover: '--btn-secondary-hover',
  btnSecondaryText: '--btn-secondary-text',
  btnGhostBg: '--btn-ghost-bg',
  btnGhostHover: '--btn-ghost-hover',
  popoverBg: '--popover-bg',
  popoverBorder: '--popover-border',
  popoverShadow: '--popover-shadow',
  calloutNote: '--callout-note',
  calloutNoteBg: '--callout-note-bg',
  calloutTip: '--callout-tip',
  calloutTipBg: '--callout-tip-bg',
  calloutWarning: '--callout-warning',
  calloutWarningBg: '--callout-warning-bg',
  calloutDanger: '--callout-danger',
  calloutDangerBg: '--callout-danger-bg',
  calloutSuccess: '--callout-success',
  calloutSuccessBg: '--callout-success-bg',
  calloutQuote: '--callout-quote',
  calloutQuoteBg: '--callout-quote-bg',
};

/** 预设主题 ID */
export const PRESET_THEME_IDS = [
  'default',
  'ocean',
  'forest',
  'sepia',
  'purple',
  'minimal',
] as const;

export type PresetThemeId = (typeof PRESET_THEME_IDS)[number];