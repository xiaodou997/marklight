import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Theme as AppTheme, ThemeId } from '../themes/types';
import { applyTheme, generateThemeId, getAllPresetThemes, getTheme } from '../themes/manager';
import {
  readStoredFocusMode,
  readStoredSettings,
  writeStoredFocusMode,
  writeStoredSettings,
} from '../services/tauri/store';

export interface Settings {
  /** Current app theme ID */
  activeThemeId: ThemeId;
  /** Custom themes */
  customThemes: AppTheme[];
  /** Font size (px) */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Auto save */
  autoSave: boolean;
  /** Auto save interval in seconds */
  autoSaveInterval: number;
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Tab width */
  tabWidth: number;
  /** Spell check */
  spellCheck: boolean;
  /** Outline expanded by default */
  outlineExpanded: boolean;
  /** Editor line height */
  lineHeight: number;
  /** Export theme */
  wechatTheme: string;
  /** Custom shortcuts */
  customShortcuts: Record<string, string>;
  /** Custom editor CSS */
  customEditorCSS: string;
  /** Config version */
  configVersion: number;
}
const DEFAULT_SETTINGS: Settings = {
  activeThemeId: 'default-light',
  customThemes: [],
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
  configVersion: 5,
};

const CURRENT_CONFIG_VERSION = 5;

export function normalizeSettings(storedSettings?: Partial<Settings> | null): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    configVersion: CURRENT_CONFIG_VERSION,
  };
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
  const isModalOpen = ref(false);
  const isFocusMode = ref(false);
  const isLoaded = ref(false);

  const presetThemes = ref(getAllPresetThemes());
  const allThemes = ref<AppTheme[]>([]);
  const currentTheme = ref<AppTheme | null>(null);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  async function saveSettingsToStore(newSettings: Settings) {
    if (!isLoaded.value) {
      return;
    }

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        await writeStoredSettings({
          ...newSettings,
          configVersion: CURRENT_CONFIG_VERSION,
        });
      } catch (error) {
        console.error('[Settings] 保存配置失败:', error);
      }
    }, 300);
  }

  async function loadSettingsFromStore(): Promise<void> {
    let shouldPersistNormalizedState: boolean;

    try {
      const [storedSettings, storedFocusMode] = await Promise.all([
        readStoredSettings<Partial<Settings>>(),
        readStoredFocusMode(),
      ]);

      if (storedSettings) {
        settings.value = normalizeSettings(storedSettings);
        shouldPersistNormalizedState =
          (storedSettings.configVersion ?? 0) !== CURRENT_CONFIG_VERSION;
        if (storedFocusMode !== undefined) {
          isFocusMode.value = storedFocusMode;
        } else {
          isFocusMode.value = false;
          shouldPersistNormalizedState = true;
        }
        console.log('[Settings] 已从 Store 加载');
      } else {
        settings.value = normalizeSettings();
        isFocusMode.value = false;
        console.log('[Settings] 首次启动，使用默认配置');
        shouldPersistNormalizedState = true;
      }

      if (shouldPersistNormalizedState) {
        await Promise.all([
          writeStoredSettings(settings.value),
          writeStoredFocusMode(isFocusMode.value),
        ]);
      }
    } catch (error) {
      console.error('[Settings] 加载配置失败:', error);
      settings.value = normalizeSettings();
      isFocusMode.value = false;
      try {
        await Promise.all([
          writeStoredSettings(settings.value),
          writeStoredFocusMode(isFocusMode.value),
        ]);
      } catch (saveError) {
        console.error('[Settings] 保存配置失败:', saveError);
      }
    }

    isLoaded.value = true;
  }

  function updateAllThemes() {
    allThemes.value = [...presetThemes.value, ...settings.value.customThemes];
  }

  function ensureThemeId(themeId: ThemeId): ThemeId {
    const theme = getTheme(themeId, settings.value.customThemes);
    if (theme) {
      return theme.id;
    }

    const fallbackAppearance = currentTheme.value?.appearance ?? 'light';
    const fallbackId = fallbackAppearance === 'dark' ? 'default-dark' : 'default-light';
    return getTheme(fallbackId, settings.value.customThemes)
      ? fallbackId
      : DEFAULT_SETTINGS.activeThemeId;
  }

  function applyCurrentTheme(themeId: ThemeId) {
    const resolvedThemeId = ensureThemeId(themeId);
    if (resolvedThemeId !== settings.value.activeThemeId) {
      settings.value.activeThemeId = resolvedThemeId;
    }

    const theme = getTheme(resolvedThemeId, settings.value.customThemes);
    if (!theme) {
      return;
    }

    currentTheme.value = theme;
    applyTheme(theme);
  }

  function setColorTheme(themeId: ThemeId) {
    settings.value.activeThemeId = themeId;
    applyCurrentTheme(themeId);
  }

  function addCustomTheme(theme: AppTheme) {
    const nextTheme: AppTheme = {
      ...theme,
      id: theme.id || generateThemeId(),
      type: 'custom',
    };
    settings.value.customThemes.push(nextTheme);
    updateAllThemes();
  }

  function updateCustomTheme(themeId: ThemeId, updatedTheme: AppTheme) {
    const index = settings.value.customThemes.findIndex((theme) => theme.id === themeId);
    if (index === -1) {
      return;
    }

    settings.value.customThemes[index] = {
      ...updatedTheme,
      id: themeId,
      type: 'custom',
    };
    updateAllThemes();

    if (settings.value.activeThemeId === themeId) {
      applyCurrentTheme(themeId);
    }
  }

  function removeCustomTheme(themeId: ThemeId) {
    const index = settings.value.customThemes.findIndex((theme) => theme.id === themeId);
    if (index === -1) {
      return;
    }

    settings.value.customThemes.splice(index, 1);
    updateAllThemes();

    if (settings.value.activeThemeId === themeId) {
      setColorTheme(DEFAULT_SETTINGS.activeThemeId);
    }
  }

  watch(
    settings,
    (newSettings) => {
      saveSettingsToStore(newSettings);
      updateAllThemes();
      applyCurrentTheme(newSettings.activeThemeId);
    },
    { deep: true },
  );

  watch(isFocusMode, (value) => {
    if (isLoaded.value) {
      void writeStoredFocusMode(value).catch((error) => {
        console.error('[Settings] 保存 focus mode 配置失败:', error);
      });
    }
    applyFocusMode(value);
  });

  function applyFocusMode(enabled: boolean) {
    document.documentElement.classList.toggle('focus-mode', enabled);
  }

  function toggleFocusMode() {
    isFocusMode.value = !isFocusMode.value;
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    settings.value[key] = value;
  }

  function updateSettings(newSettings: Partial<Settings>) {
    settings.value = { ...settings.value, ...newSettings };
  }

  function resetSettings() {
    Object.assign(settings.value, { ...DEFAULT_SETTINGS });
  }

  function openModal() {
    isModalOpen.value = true;
  }

  function closeModal() {
    isModalOpen.value = false;
  }

  function initTheme() {
    updateAllThemes();
    applyCurrentTheme(settings.value.activeThemeId);
  }

  function initFocusMode() {
    applyFocusMode(isFocusMode.value);
  }

  async function init() {
    await loadSettingsFromStore();
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
