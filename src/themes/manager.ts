/**
 * Theme manager.
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Theme, ThemeAppearance, ThemeColors } from './types';
import { CSS_VAR_MAP } from './types';

import defaultLightTheme from './presets/default.json';
import defaultDarkTheme from './presets/default-dark.json';
import oceanLightTheme from './presets/ocean.json';
import oceanDarkTheme from './presets/ocean-dark.json';
import forestLightTheme from './presets/forest.json';
import forestDarkTheme from './presets/forest-dark.json';
import sepiaLightTheme from './presets/sepia.json';
import sepiaDarkTheme from './presets/sepia-dark.json';
import purpleLightTheme from './presets/purple.json';
import purpleDarkTheme from './presets/purple-dark.json';
import minimalLightTheme from './presets/minimal.json';
import minimalDarkTheme from './presets/minimal-dark.json';

const PRESET_THEMES: Theme[] = [
  defaultLightTheme as Theme,
  defaultDarkTheme as Theme,
  oceanLightTheme as Theme,
  oceanDarkTheme as Theme,
  forestLightTheme as Theme,
  forestDarkTheme as Theme,
  sepiaLightTheme as Theme,
  sepiaDarkTheme as Theme,
  purpleLightTheme as Theme,
  purpleDarkTheme as Theme,
  minimalLightTheme as Theme,
  minimalDarkTheme as Theme,
];

const presetThemeMap = new Map<string, Theme>(PRESET_THEMES.map((theme) => [theme.id, theme]));

let isDarkMode = false;

interface LegacyThemeFile {
  id: string;
  name: string;
  type?: 'preset' | 'custom';
  author?: string;
  description?: string;
  version?: string;
  light: ThemeColors;
  dark: ThemeColors;
}

function injectColors(colors: ThemeColors) {
  const style = document.documentElement.style;

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const colorKey = key as keyof ThemeColors;
    style.setProperty(cssVar, colors[colorKey]);
  }
}

function applyDarkClass(appearance: ThemeAppearance) {
  isDarkMode = appearance === 'dark';
  document.documentElement.classList.toggle('dark', isDarkMode);
}

async function syncNativeWindowTheme(appearance: ThemeAppearance) {
  try {
    await getCurrentWindow().setTheme(appearance);
  } catch {
    // Ignore in unsupported environments.
  }
}

async function syncNativeWindowBackground(bgColor: string) {
  try {
    await invoke('set_window_background_color', { color: bgColor });
  } catch {
    // Ignore in unsupported environments.
  }
}

export function applyTheme(theme: Theme) {
  applyDarkClass(theme.appearance);
  injectColors(theme.colors);
  void syncNativeWindowTheme(theme.appearance);
  void syncNativeWindowBackground(theme.colors.bgColor);
}

export function getPresetTheme(id: string): Theme | undefined {
  return presetThemeMap.get(id);
}

export function getAllPresetThemes(): Theme[] {
  return PRESET_THEMES;
}

export function getTheme(id: string, customThemes: Theme[]): Theme | undefined {
  return presetThemeMap.get(id) ?? customThemes.find((theme) => theme.id === id);
}

export function exportTheme(theme: Theme): string {
  return JSON.stringify(theme, null, 2);
}

function isThemeColors(value: unknown): value is ThemeColors {
  return typeof value === 'object' && value !== null && 'bgColor' in value && 'textColor' in value;
}

function isModernTheme(value: unknown): value is Theme {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'appearance' in value &&
    'colors' in value &&
    isThemeColors((value as { colors: unknown }).colors)
  );
}

function isLegacyTheme(value: unknown): value is LegacyThemeFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'light' in value &&
    'dark' in value &&
    isThemeColors((value as { light: unknown }).light) &&
    isThemeColors((value as { dark: unknown }).dark)
  );
}

export function importTheme(json: string, appearance: ThemeAppearance = 'light'): Theme {
  const parsed = JSON.parse(json) as unknown;

  if (isModernTheme(parsed)) {
    return {
      ...parsed,
      type: 'custom',
    };
  }

  if (isLegacyTheme(parsed)) {
    return {
      id: parsed.id,
      name: parsed.name,
      type: 'custom',
      appearance,
      author: parsed.author,
      description: parsed.description,
      version: parsed.version,
      colors: appearance === 'dark' ? parsed.dark : parsed.light,
    };
  }

  throw new Error('无效的主题 JSON：缺少必要字段');
}

export function generateThemeId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneTheme(theme: Theme): Theme {
  return JSON.parse(JSON.stringify(theme));
}

export function getIsDarkMode(): boolean {
  return isDarkMode;
}

export const ThemeManager = {
  applyTheme,
  getPresetTheme,
  getAllPresetThemes,
  getTheme,
  exportTheme,
  importTheme,
  generateThemeId,
  cloneTheme,
  getIsDarkMode,
};
