import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Theme as ColorTheme, ThemeMode, ThemeId } from '../themes/types';
import { applyTheme, getTheme, getAllPresetThemes, generateThemeId } from '../themes/manager';

export type Theme = 'light' | 'dark' | 'system';

export interface CustomTheme {
  primary: string;
  background: string;
  text: string;
  sidebar: string;
  border: string;
}

export interface Settings {
  /** 主题模式 (light/dark/system) */
  theme: Theme;
  /** 颜色主题 ID */
  activeThemeId: ThemeId;
  /** 自定义颜色主题列表 */
  customThemes: ColorTheme[];
  /** 自定义主题配色 (legacy, 已废弃) */
  customTheme: CustomTheme;
  /** 字体大小 (px) */
  fontSize: number;
  /** 字体族 */
  fontFamily: string;
  /** 自动保存 */
  autoSave: boolean;
  /** 自动保存间隔 (秒) */
  autoSaveInterval: number;
  /** 显示行号 */
  showLineNumbers: boolean;
  /** Tab 宽度 */
  tabWidth: number;
  /** 拼写检查 */
  spellCheck: boolean;
  /** 大纲默认展开 */
  outlineExpanded: boolean;
  /** 编辑器行高 */
  lineHeight: number;
  /** 微信导出主题 */
  wechatTheme: string;
  /** 自定义快捷键 */
  customShortcuts: Record<string, string>;
  /** 自定义编辑器 CSS（用于覆盖渲染样式） */
  customEditorCSS: string;
  /** 配置版本号 (用于迁移) */
  configVersion: number;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system' as Theme,
  activeThemeId: 'default',
  customThemes: [],
  customTheme: {
    primary: '#4a90d9',
    background: '#ffffff',
    text: '#333333',
    sidebar: '#f9fafb',
    border: '#e5e7eb',
  },
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  autoSave: false,
  autoSaveInterval: 30,
  showLineNumbers: false,
  tabWidth: 4,
  spellCheck: true,
  outlineExpanded: true,
  lineHeight: 1.6,
  wechatTheme: 'blue',
  customShortcuts: {},
  customEditorCSS: '',
  configVersion: 3,
};

const LEGACY_STORAGE_KEY = 'marklight-settings';
const FOCUS_MODE_KEY = 'marklight-focus-mode';
const CURRENT_CONFIG_VERSION = 3;

function migrateConfig(config: Partial<Settings>): Partial<Settings> {
  const next = { ...config };

  // v2 -> v3: 添加主题系统字段
  if (!next.activeThemeId) {
    next.activeThemeId = 'default';
  }
  if (!next.customThemes) {
    next.customThemes = [];
  }

  next.configVersion = CURRENT_CONFIG_VERSION;
  return next;
}

/**
 * 从 localStorage 迁移旧配置
 */
function migrateFromLocalStorage(): Partial<Settings> | null {
  try {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('[Settings] 发现 localStorage 配置，正在迁移...');
      // 迁移完成后删除旧数据
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return parsed;
    }
  } catch (e) {
    console.error('[Settings] 迁移 localStorage 配置失败:', e);
  }
  return null;
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
  const isModalOpen = ref(false);
  const isFocusMode = ref(localStorage.getItem(FOCUS_MODE_KEY) === 'true');
  const isLoaded = ref(false);

  // 预设主题列表
  const presetThemes = ref(getAllPresetThemes());

  // 所有可用主题（预设 + 自定义）
  const allThemes = ref<ColorTheme[]>([]);

  // 当前使用的主题
  const currentTheme = ref<ColorTheme | null>(null);

  // 保存配置到文件（防抖）
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  async function saveSettingsToFile(newSettings: Settings) {
    if (!isLoaded.value) return; // 未加载完成不保存

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        await invoke('write_config', {
          config: {
            ...newSettings,
            configVersion: CURRENT_CONFIG_VERSION
          }
        });
      } catch (e) {
        console.error('[Settings] 保存配置失败:', e);
      }
    }, 300);
  }

  // 从文件加载配置
  async function loadSettingsFromFile(): Promise<void> {
    try {
      const config = await invoke<Record<string, unknown>>('read_config');

      if (Object.keys(config).length > 0) {
        // 已有配置文件
        Object.assign(settings.value, { ...DEFAULT_SETTINGS, ...migrateConfig(config as Partial<Settings>) });
        console.log('[Settings] 已从配置文件加载');
      } else {
        // 配置文件不存在，尝试迁移 localStorage
        const legacySettings = migrateFromLocalStorage();
        if (legacySettings) {
          Object.assign(settings.value, { ...DEFAULT_SETTINGS, ...migrateConfig(legacySettings) });
          console.log('[Settings] localStorage 配置已迁移到文件');
        } else {
          console.log('[Settings] 首次启动，使用默认配置');
        }
        // 保存当前配置到文件（包括默认配置）
        await invoke('write_config', { config: settings.value });
      }
    } catch (e) {
      console.error('[Settings] 加载配置失败:', e);
      // 尝试从 localStorage 恢复
      const legacySettings = migrateFromLocalStorage();
      if (legacySettings) {
        Object.assign(settings.value, { ...DEFAULT_SETTINGS, ...migrateConfig(legacySettings) });
      }
      // 尝试保存配置
      try {
        await invoke('write_config', { config: settings.value });
      } catch (saveError) {
        console.error('[Settings] 保存配置失败:', saveError);
      }
    }

    isLoaded.value = true;
  }

  // 更新主题列表
  function updateAllThemes() {
    allThemes.value = [...presetThemes.value, ...settings.value.customThemes];
  }

  // 应用颜色主题
  function applyColorTheme(themeId: ThemeId, mode: ThemeMode) {
    const theme = getTheme(themeId, settings.value.customThemes);
    if (theme) {
      currentTheme.value = theme;
      applyTheme(theme, mode);
    }
  }

  // 切换颜色主题
  function setColorTheme(themeId: ThemeId) {
    settings.value.activeThemeId = themeId;
    applyColorTheme(themeId, settings.value.theme);
  }

  // 添加自定义主题
  function addCustomTheme(theme: ColorTheme) {
    theme.id = generateThemeId();
    theme.type = 'custom';
    settings.value.customThemes.push(theme);
    updateAllThemes();
  }

  // 更新自定义主题
  function updateCustomTheme(themeId: ThemeId, updatedTheme: ColorTheme) {
    const idx = settings.value.customThemes.findIndex(t => t.id === themeId);
    if (idx !== -1) {
      settings.value.customThemes[idx] = updatedTheme;
      updateAllThemes();
      // 如果是当前使用的主题，重新应用
      if (settings.value.activeThemeId === themeId) {
        applyColorTheme(themeId, settings.value.theme);
      }
    }
  }

  // 删除自定义主题
  function removeCustomTheme(themeId: ThemeId) {
    const idx = settings.value.customThemes.findIndex(t => t.id === themeId);
    if (idx !== -1) {
      settings.value.customThemes.splice(idx, 1);
      updateAllThemes();
      // 如果删除的是当前使用的主题，切换回默认
      if (settings.value.activeThemeId === themeId) {
        setColorTheme('default');
      }
    }
  }

  // 监听设置变化，自动保存
  watch(settings, (newSettings) => {
    saveSettingsToFile(newSettings);
    applyThemeMode(newSettings.theme);
    applyColorTheme(newSettings.activeThemeId, newSettings.theme);
    updateAllThemes();
  }, { deep: true });

  // 监听焦点模式变化
  watch(isFocusMode, (value) => {
    localStorage.setItem(FOCUS_MODE_KEY, String(value));
    applyFocusMode(value);
  });

  // 系统深色模式媒体查询监听
  let systemDarkMQ: MediaQueryList | null = null;
  let systemDarkListener: (() => void) | null = null;

  function applyDarkClass(dark: boolean) {
    document.documentElement.classList.toggle('dark', dark);
  }

  // 应用主题模式（light / dark / system）
  function applyThemeMode(themeMode: Theme) {
    // 清理旧的系统监听
    if (systemDarkListener && systemDarkMQ) {
      systemDarkMQ.removeEventListener('change', systemDarkListener);
      systemDarkListener = null;
      systemDarkMQ = null;
    }

    if (themeMode === 'dark') {
      applyDarkClass(true);
    } else if (themeMode === 'light') {
      applyDarkClass(false);
    } else {
      // system：跟随系统
      systemDarkMQ = window.matchMedia('(prefers-color-scheme: dark)');
      applyDarkClass(systemDarkMQ.matches);
      systemDarkListener = () => {
        applyDarkClass(systemDarkMQ!.matches);
        // 系统模式变化时重新应用颜色主题
        applyColorTheme(settings.value.activeThemeId, 'system');
      };
      systemDarkMQ.addEventListener('change', systemDarkListener);
    }
  }

  // 应用焦点模式
  function applyFocusMode(enabled: boolean) {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('focus-mode');
    } else {
      root.classList.remove('focus-mode');
    }
  }

  // 切换焦点模式
  function toggleFocusMode() {
    isFocusMode.value = !isFocusMode.value;
  }

  // 更新单个设置
  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    settings.value[key] = value;
  }

  // 批量更新设置
  function updateSettings(newSettings: Partial<Settings>) {
    settings.value = { ...settings.value, ...newSettings };
  }

  // 重置为默认值
  function resetSettings() {
    Object.assign(settings.value, { ...DEFAULT_SETTINGS });
  }

  // 打开设置弹窗
  function openModal() {
    isModalOpen.value = true;
  }

  // 关闭设置弹窗
  function closeModal() {
    isModalOpen.value = false;
  }

  // 初始化主题
  function initTheme() {
    updateAllThemes();
    applyThemeMode(settings.value.theme);
    applyColorTheme(settings.value.activeThemeId, settings.value.theme);
  }

  // 初始化焦点模式
  function initFocusMode() {
    applyFocusMode(isFocusMode.value);
  }

  // 初始化：加载配置
  async function init() {
    await loadSettingsFromFile();
    initTheme();
    initFocusMode();
  }

  return {
    settings,
    isModalOpen,
    isFocusMode,
    isLoaded,
    presetThemes,
    allThemes,
    currentTheme,
    setColorTheme,
    addCustomTheme,
    updateCustomTheme,
    removeCustomTheme,
    updateSetting,
    updateSettings,
    resetSettings,
    openModal,
    closeModal,
    initTheme,
    initFocusMode,
    toggleFocusMode,
    init,
  };
});