import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  /** 主题 */
  theme: Theme;
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
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  autoSave: false,
  autoSaveInterval: 30,
  showLineNumbers: false,
  tabWidth: 4,
  spellCheck: true,
  outlineExpanded: true,
  lineHeight: 1.6,
};

const STORAGE_KEY = 'marklight-settings';

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(loadSettings());
  const isModalOpen = ref(false);

  // 监听设置变化，自动保存
  watch(settings, (newSettings) => {
    saveSettings(newSettings);
    applyTheme(newSettings.theme);
  }, { deep: true });

  // 应用主题
  function applyTheme(theme: Theme) {
    const root = document.documentElement;
    const isDark = theme === 'dark' || 
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
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
    
    // 监听系统主题变化
    if (settings.value.theme === 'system') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        applyTheme('system');
      });
    }
  }

  return {
    settings,
    isModalOpen,
    updateSetting,
    updateSettings,
    resetSettings,
    openModal,
    closeModal,
    initTheme,
  };
});
