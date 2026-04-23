import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type {
  Theme as AppTheme,
  ThemeAppearance,
  ThemeColors,
  ThemeId,
} from '../themes/types';
import { applyTheme, generateThemeId, getAllPresetThemes, getTheme } from '../themes/manager';

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

type LegacyThemeMode = 'light' | 'dark' | 'system';

type LegacyTheme = Omit<AppTheme, 'appearance' | 'colors'> & {
  light: ThemeColors;
  dark: ThemeColors;
};

type SettingsLike = Partial<Settings> & {
  theme?: LegacyThemeMode;
  customThemes?: Array<AppTheme | LegacyTheme>;
  configVersion?: number;
};

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

const LEGACY_STORAGE_KEY = 'marklight-settings';
const FOCUS_MODE_KEY = 'marklight-focus-mode';
const CURRENT_CONFIG_VERSION = 5;

function isModernTheme(theme: AppTheme | LegacyTheme): theme is AppTheme {
  return 'appearance' in theme && 'colors' in theme;
}

function isLegacyTheme(theme: AppTheme | LegacyTheme): theme is LegacyTheme {
  return 'light' in theme && 'dark' in theme;
}

function normalizeLegacyName(name: string, appearance: ThemeAppearance) {
  return `${name} ${appearance === 'dark' ? 'Dark' : 'Light'}`;
}

function splitLegacyTheme(theme: LegacyTheme): AppTheme[] {
  return [
    {
      id: `${theme.id}-light`,
      name: normalizeLegacyName(theme.name, 'light'),
      type: 'custom',
      appearance: 'light',
      author: theme.author,
      description: theme.description,
      version: theme.version,
      colors: theme.light,
    },
    {
      id: `${theme.id}-dark`,
      name: normalizeLegacyName(theme.name, 'dark'),
      type: 'custom',
      appearance: 'dark',
      author: theme.author,
      description: theme.description,
      version: theme.version,
      colors: theme.dark,
    },
  ];
}

function getPreferredAppearance(themeMode?: LegacyThemeMode): ThemeAppearance {
  if (themeMode === 'dark') {
    return 'dark';
  }

  if (themeMode === 'system' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

function resolveMigratedThemeId(themeId: string | undefined, appearance: ThemeAppearance): ThemeId {
  const baseId = themeId?.trim() || 'default';

  if (baseId.endsWith('-light') || baseId.endsWith('-dark')) {
    return baseId;
  }

  return `${baseId}-${appearance}`;
}

export function migrateConfig(config: SettingsLike): Partial<Settings> {
  const next: Partial<Settings> = { ...config };
  const preferredAppearance = getPreferredAppearance(config.theme);
  const shouldMigrateThemeSelection =
    (config.configVersion ?? 0) < CURRENT_CONFIG_VERSION || typeof config.theme === 'string';

  const migratedThemes: AppTheme[] = (config.customThemes ?? []).flatMap((theme) => {
    if (isModernTheme(theme)) {
      return [
        {
          ...theme,
          type: 'custom' as const,
        },
      ];
    }

    if (isLegacyTheme(theme)) {
      return splitLegacyTheme(theme);
    }

    return [];
  });

  next.activeThemeId = shouldMigrateThemeSelection
    ? resolveMigratedThemeId(config.activeThemeId, preferredAppearance)
    : (config.activeThemeId ?? DEFAULT_SETTINGS.activeThemeId);
  next.customThemes = migratedThemes;

  if ((next.configVersion ?? 0) < 4) {
    next.customShortcuts = {};
  }

  next.configVersion = CURRENT_CONFIG_VERSION;
  delete (next as SettingsLike).theme;

  return next;
}

function migrateFromLocalStorage(): Partial<Settings> | null {
  try {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as SettingsLike;
      console.log('[Settings] 发现 localStorage 配置，正在迁移...');
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrateConfig(parsed);
    }
  } catch (error) {
    console.error('[Settings] 迁移 localStorage 配置失败:', error);
  }

  return null;
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
  const isModalOpen = ref(false);
  const isFocusMode = ref(localStorage.getItem(FOCUS_MODE_KEY) === 'true');
  const isLoaded = ref(false);

  const presetThemes = ref(getAllPresetThemes());
  const allThemes = ref<AppTheme[]>([]);
  const currentTheme = ref<AppTheme | null>(null);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  async function saveSettingsToFile(newSettings: Settings) {
    if (!isLoaded.value) {
      return;
    }

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        await invoke('write_config', {
          config: {
            ...newSettings,
            configVersion: CURRENT_CONFIG_VERSION,
          },
        });
      } catch (error) {
        console.error('[Settings] 保存配置失败:', error);
      }
    }, 300);
  }

  async function loadSettingsFromFile(): Promise<void> {
    try {
      const config = await invoke<Record<string, unknown>>('read_config');

      if (Object.keys(config).length > 0) {
        Object.assign(settings.value, {
          ...DEFAULT_SETTINGS,
          ...migrateConfig(config as SettingsLike),
        });
        console.log('[Settings] 已从配置文件加载');
      } else {
        const legacySettings = migrateFromLocalStorage();
        if (legacySettings) {
          Object.assign(settings.value, {
            ...DEFAULT_SETTINGS,
            ...legacySettings,
          });
          console.log('[Settings] localStorage 配置已迁移到文件');
        } else {
          console.log('[Settings] 首次启动，使用默认配置');
        }
        await invoke('write_config', { config: settings.value });
      }
    } catch (error) {
      console.error('[Settings] 加载配置失败:', error);
      const legacySettings = migrateFromLocalStorage();
      if (legacySettings) {
        Object.assign(settings.value, {
          ...DEFAULT_SETTINGS,
          ...legacySettings,
        });
      }
      try {
        await invoke('write_config', { config: settings.value });
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
    return getTheme(fallbackId, settings.value.customThemes) ? fallbackId : DEFAULT_SETTINGS.activeThemeId;
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
      saveSettingsToFile(newSettings);
      updateAllThemes();
      applyCurrentTheme(newSettings.activeThemeId);
    },
    { deep: true },
  );

  watch(isFocusMode, (value) => {
    localStorage.setItem(FOCUS_MODE_KEY, String(value));
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
