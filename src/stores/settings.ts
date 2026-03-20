import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export type Theme = 'light';

export interface CustomTheme {
  primary: string;
  background: string;
  text: string;
  sidebar: string;
  border: string;
}

export interface Settings {
  /** 主题 */
  theme: Theme;
  /** 自定义主题配色 */
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
  /** 配置版本号 (用于迁移) */
  configVersion: number;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light' as Theme,
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
  configVersion: 2,
};

const LEGACY_STORAGE_KEY = 'marklight-settings';
const FOCUS_MODE_KEY = 'marklight-focus-mode';
const CURRENT_CONFIG_VERSION = 2;

function migrateConfig(config: Partial<Settings>): Partial<Settings> {
  const next = { ...config } as Partial<Settings> & Record<string, unknown>;
  if ('editorEngine' in next) {
    delete next.editorEngine;
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
        settings.value = { ...DEFAULT_SETTINGS, ...migrateConfig(config as Partial<Settings>) };
        console.log('[Settings] 已从配置文件加载');
      } else {
        // 配置文件不存在，尝试迁移 localStorage
        const legacySettings = migrateFromLocalStorage();
        if (legacySettings) {
          settings.value = { ...DEFAULT_SETTINGS, ...migrateConfig(legacySettings) };
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
        settings.value = { ...DEFAULT_SETTINGS, ...migrateConfig(legacySettings) };
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

  // 监听设置变化，自动保存
  watch(settings, (newSettings) => {
    saveSettingsToFile(newSettings);
    applyTheme(newSettings.theme);
  }, { deep: true });

  // 监听焦点模式变化
  watch(isFocusMode, (value) => {
    localStorage.setItem(FOCUS_MODE_KEY, String(value));
    applyFocusMode(value);
  });

  // 应用主题（当前只支持浅色）
  function applyTheme(_theme: Theme) {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.removeProperty('--primary-color');
    root.style.removeProperty('--bg-color');
    root.style.removeProperty('--text-color');
    root.style.removeProperty('--sidebar-bg');
    root.style.removeProperty('--border-color');
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
    settings.value = { ...DEFAULT_SETTINGS };
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
    applyTheme(settings.value.theme);
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
