/**
 * 主题管理器
 *
 * 负责主题加载、切换、持久化和 CSS 变量注入
 */

import type { Theme, ThemeMode, ThemeColors } from './types';
import { CSS_VAR_MAP } from './types';

// 预设主题导入
import defaultTheme from './presets/default.json';
import oceanTheme from './presets/ocean.json';
import forestTheme from './presets/forest.json';
import sepiaTheme from './presets/sepia.json';
import purpleTheme from './presets/purple.json';
import minimalTheme from './presets/minimal.json';

/** 预设主题列表 */
const PRESET_THEMES: Theme[] = [
  defaultTheme as Theme,
  oceanTheme as Theme,
  forestTheme as Theme,
  sepiaTheme as Theme,
  purpleTheme as Theme,
  minimalTheme as Theme,
];

/** 预设主题 Map (id -> theme) */
const presetThemeMap = new Map<string, Theme>(
  PRESET_THEMES.map((t) => [t.id, t])
);

/** 系统深色偏好监听器 */
let systemDarkMQ: MediaQueryList | null = null;

/** 当前是否深色模式 */
let isDarkMode = false;

/**
 * 将颜色配置注入为 CSS 变量
 */
function injectColors(colors: ThemeColors, _scope: ':root' | 'html.dark') {
  const root = document.documentElement;
  const style = root.style;

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const colorKey = key as keyof ThemeColors;
    const value = colors[colorKey];
    if (value) {
      style.setProperty(cssVar, value);
    }
  }
}

/**
 * 应用主题
 */
export function applyTheme(theme: Theme, mode: ThemeMode) {
  // 先注入浅色主题变量
  injectColors(theme.light, ':root');

  // 处理深色模式
  if (mode === 'dark') {
    applyDarkClass(true);
    injectColors(theme.dark, 'html.dark');
  } else if (mode === 'light') {
    applyDarkClass(false);
  } else {
    // system: 跟随系统偏好
    setupSystemModeListener(() => {
      injectColors(theme.dark, 'html.dark');
    });
  }

  // 存储 CSS 变量到 style 元素（便于主题编辑时实时预览）
  updateThemeStyleElement(theme);
}

/**
 * 更新主题样式元素
 */
function updateThemeStyleElement(theme: Theme) {
  // 生成 CSS 文本
  const lightVars = generateCssVars(theme.light, ':root');
  const darkVars = generateCssVars(theme.dark, 'html.dark');

  // 查找或创建主题样式元素
  let styleEl = document.getElementById('mk-theme-vars');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'mk-theme-vars';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `${lightVars}\n${darkVars}`;
}

/**
 * 生成 CSS 变量文本
 */
function generateCssVars(colors: ThemeColors, scope: string): string {
  const lines: string[] = [`${scope} {`];

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const colorKey = key as keyof ThemeColors;
    const value = colors[colorKey];
    if (value) {
      lines.push(`  ${cssVar}: ${value};`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * 应用/移除 dark 类
 */
function applyDarkClass(dark: boolean) {
  isDarkMode = dark;
  document.documentElement.classList.toggle('dark', dark);
}

/**
 * 设置系统模式监听器
 */
function setupSystemModeListener(onDarkChange: () => void) {
  systemDarkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  applyDarkClass(systemDarkMQ.matches);
  onDarkChange();

  systemDarkMQ.addEventListener('change', (e) => {
    applyDarkClass(e.matches);
    onDarkChange();
  });
}

/**
 * 获取预设主题
 */
export function getPresetTheme(id: string): Theme | undefined {
  return presetThemeMap.get(id);
}

/**
 * 获取所有预设主题
 */
export function getAllPresetThemes(): Theme[] {
  return PRESET_THEMES;
}

/**
 * 获取主题（预设或自定义）
 */
export function getTheme(id: string, customThemes: Theme[]): Theme | undefined {
  // 先查找预设
  const preset = presetThemeMap.get(id);
  if (preset) return preset;

  // 查找自定义
  return customThemes.find((t) => t.id === id);
}

/**
 * 导出主题为 JSON
 */
export function exportTheme(theme: Theme): string {
  return JSON.stringify(theme, null, 2);
}

/**
 * 导入主题 JSON
 */
export function importTheme(json: string): Theme {
  const theme = JSON.parse(json) as Theme;

  // 验证必要字段
  if (!theme.id || !theme.name || !theme.light || !theme.dark) {
    throw new Error('无效的主题 JSON：缺少必要字段');
  }

  // 础保类型标记为自定义
  theme.type = 'custom';

  return theme;
}

/**
 * 生成唯一主题 ID
 */
export function generateThemeId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 克隆主题（用于编辑）
 */
export function cloneTheme(theme: Theme): Theme {
  return JSON.parse(JSON.stringify(theme));
}

/**
 * 获取当前是否深色模式
 */
export function getIsDarkMode(): boolean {
  return isDarkMode;
}

/**
 * 导出模块
 */
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