import { defineStore } from 'pinia';
import { watch, type WatchStopHandle } from 'vue';
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
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let stopSettingsWatcher: WatchStopHandle | null = null;
let stopFocusModeWatcher: WatchStopHandle | null = null;

export function normalizeSettings(storedSettings?: Partial<Settings> | null): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    configVersion: CURRENT_CONFIG_VERSION,
  };
}

interface SettingsStoreState {
  settings: Settings;
  isModalOpen: boolean;
  isFocusMode: boolean;
  isLoaded: boolean;
  presetThemes: AppTheme[];
  allThemes: AppTheme[];
  currentTheme: AppTheme | null;
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsStoreState => ({
    settings: normalizeSettings(),
    isModalOpen: false,
    isFocusMode: false,
    isLoaded: false,
    presetThemes: getAllPresetThemes(),
    allThemes: [],
    currentTheme: null,
  }),

  actions: {
    async saveSettingsToStore(newSettings: Settings) {
      if (!this.isLoaded) {
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
    },

    async loadSettingsFromStore(): Promise<void> {
      let shouldPersistNormalizedState: boolean;

      try {
        const [storedSettings, storedFocusMode] = await Promise.all([
          readStoredSettings<Partial<Settings>>(),
          readStoredFocusMode(),
        ]);

        if (storedSettings) {
          this.settings = normalizeSettings(storedSettings);
          shouldPersistNormalizedState =
            (storedSettings.configVersion ?? 0) !== CURRENT_CONFIG_VERSION;
          if (storedFocusMode !== undefined) {
            this.isFocusMode = storedFocusMode;
          } else {
            this.isFocusMode = false;
            shouldPersistNormalizedState = true;
          }
        } else {
          this.settings = normalizeSettings();
          this.isFocusMode = false;
          shouldPersistNormalizedState = true;
        }

        if (shouldPersistNormalizedState) {
          await Promise.all([
            writeStoredSettings(this.settings),
            writeStoredFocusMode(this.isFocusMode),
          ]);
        }
      } catch (error) {
        console.error('[Settings] 加载配置失败:', error);
        this.settings = normalizeSettings();
        this.isFocusMode = false;
        try {
          await Promise.all([
            writeStoredSettings(this.settings),
            writeStoredFocusMode(this.isFocusMode),
          ]);
        } catch (saveError) {
          console.error('[Settings] 保存配置失败:', saveError);
        }
      }

      this.isLoaded = true;
    },

    updateAllThemes() {
      this.allThemes = [...this.presetThemes, ...this.settings.customThemes];
    },

    ensureThemeId(themeId: ThemeId): ThemeId {
      const theme = getTheme(themeId, this.settings.customThemes);
      if (theme) {
        return theme.id;
      }

      const fallbackAppearance = this.currentTheme?.appearance ?? 'light';
      const fallbackId = fallbackAppearance === 'dark' ? 'default-dark' : 'default-light';
      return getTheme(fallbackId, this.settings.customThemes)
        ? fallbackId
        : DEFAULT_SETTINGS.activeThemeId;
    },

    applyCurrentTheme(themeId: ThemeId) {
      const resolvedThemeId = this.ensureThemeId(themeId);
      if (resolvedThemeId !== this.settings.activeThemeId) {
        this.settings.activeThemeId = resolvedThemeId;
      }

      const theme = getTheme(resolvedThemeId, this.settings.customThemes);
      if (!theme) {
        return;
      }

      this.currentTheme = theme;
      applyTheme(theme);
    },

    setColorTheme(themeId: ThemeId) {
      this.settings.activeThemeId = themeId;
      this.applyCurrentTheme(themeId);
    },

    addCustomTheme(theme: AppTheme) {
      const nextTheme: AppTheme = {
        ...theme,
        id: theme.id || generateThemeId(),
        type: 'custom',
      };
      this.settings.customThemes.push(nextTheme);
      this.updateAllThemes();
    },

    updateCustomTheme(themeId: ThemeId, updatedTheme: AppTheme) {
      const index = this.settings.customThemes.findIndex((theme) => theme.id === themeId);
      if (index === -1) {
        return;
      }

      this.settings.customThemes[index] = {
        ...updatedTheme,
        id: themeId,
        type: 'custom',
      };
      this.updateAllThemes();

      if (this.settings.activeThemeId === themeId) {
        this.applyCurrentTheme(themeId);
      }
    },

    removeCustomTheme(themeId: ThemeId) {
      const index = this.settings.customThemes.findIndex((theme) => theme.id === themeId);
      if (index === -1) {
        return;
      }

      this.settings.customThemes.splice(index, 1);
      this.updateAllThemes();

      if (this.settings.activeThemeId === themeId) {
        this.setColorTheme(DEFAULT_SETTINGS.activeThemeId);
      }
    },

    startWatchers() {
      if (!stopSettingsWatcher) {
        stopSettingsWatcher = watch(
          () => this.settings,
          (newSettings) => {
            void this.saveSettingsToStore(newSettings);
            this.updateAllThemes();
            this.applyCurrentTheme(newSettings.activeThemeId);
          },
          { deep: true },
        );
      }

      if (!stopFocusModeWatcher) {
        stopFocusModeWatcher = watch(
          () => this.isFocusMode,
          (value) => {
            if (this.isLoaded) {
              void writeStoredFocusMode(value).catch((error) => {
                console.error('[Settings] 保存 focus mode 配置失败:', error);
              });
            }
            this.applyFocusMode(value);
          },
        );
      }
    },

    applyFocusMode(enabled: boolean) {
      document.documentElement.classList.toggle('focus-mode', enabled);
    },

    toggleFocusMode() {
      this.isFocusMode = !this.isFocusMode;
    },

    updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
      this.settings[key] = value;
    },

    updateSettings(newSettings: Partial<Settings>) {
      this.settings = normalizeSettings({
        ...this.settings,
        ...newSettings,
      });
    },

    resetSettings() {
      this.settings = normalizeSettings();
    },

    openModal() {
      this.isModalOpen = true;
    },

    closeModal() {
      this.isModalOpen = false;
    },

    initTheme() {
      this.updateAllThemes();
      this.applyCurrentTheme(this.settings.activeThemeId);
    },

    initFocusMode() {
      this.applyFocusMode(this.isFocusMode);
    },

    async init() {
      await this.loadSettingsFromStore();
      this.startWatchers();
      this.initTheme();
      this.initFocusMode();
    },
  },
});
