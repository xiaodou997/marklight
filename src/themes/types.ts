/**
 * Theme type definitions.
 */

/** Theme ID */
export type ThemeId = string;

/** Theme type */
export type ThemeType = 'preset' | 'custom';

/** Theme appearance */
export type ThemeAppearance = 'light' | 'dark';

/** Theme metadata */
export interface ThemeMeta {
  /** Theme unique identifier */
  id: ThemeId;
  /** Theme display name */
  name: string;
  /** Theme source */
  type: ThemeType;
  /** Theme appearance */
  appearance: ThemeAppearance;
  /** Theme author */
  author?: string;
  /** Theme description */
  description?: string;
  /** Theme version */
  version?: string;
}

/** Theme colors */
export interface ThemeColors {
  primaryColor: string;
  primaryHover: string;
  primaryLight: string;
  bgColor: string;
  bgSecondary: string;
  textColor: string;
  textSecondary: string;
  mutedColor: string;
  borderColor: string;
  borderLight: string;
  sidebarBg: string;
  sidebarHover: string;
  codeBg: string;
  codeBorder: string;
  hoverBg: string;
  activeBg: string;
  selectedBg: string;
  quoteBg: string;
  tagBg: string;
  tagColor: string;
  successColor: string;
  successBg: string;
  warningColor: string;
  warningBg: string;
  errorColor: string;
  errorBg: string;
  infoColor: string;
  infoBg: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowXl: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  modalBg: string;
  modalBorder: string;
  modalOverlay: string;
  modalShadow: string;
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
  inputFocusShadow: string;
  inputPlaceholder: string;
  btnPrimaryBg: string;
  btnPrimaryHover: string;
  btnPrimaryText: string;
  btnSecondaryBg: string;
  btnSecondaryHover: string;
  btnSecondaryText: string;
  btnGhostBg: string;
  btnGhostHover: string;
  popoverBg: string;
  popoverBorder: string;
  popoverShadow: string;
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

/** Single theme definition */
export interface Theme extends ThemeMeta {
  /** Theme colors */
  colors: ThemeColors;
}

/** Theme state */
export interface ThemeState {
  /** Current theme ID */
  activeThemeId: ThemeId;
  /** Custom themes */
  customThemes: Theme[];
}

/** CSS variable map */
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

/** Preset theme IDs */
export const PRESET_THEME_IDS = [
  'default-light',
  'default-dark',
  'ocean-light',
  'ocean-dark',
  'forest-light',
  'forest-dark',
  'sepia-light',
  'sepia-dark',
  'purple-light',
  'purple-dark',
  'minimal-light',
  'minimal-dark',
] as const;

export type PresetThemeId = (typeof PRESET_THEME_IDS)[number];
