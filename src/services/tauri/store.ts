import { LazyStore } from '@tauri-apps/plugin-store';

const APP_STORE_PATH = 'settings.json';
const SETTINGS_KEY = 'settings';
const FOCUS_MODE_KEY = 'focusMode';

const appStore = new LazyStore(APP_STORE_PATH, {
  defaults: {},
  autoSave: false,
});

export async function readStoredSettings<T>() {
  return appStore.get<T>(SETTINGS_KEY);
}

export async function writeStoredSettings(settings: unknown) {
  await appStore.set(SETTINGS_KEY, settings);
  await appStore.save();
}

export async function readStoredFocusMode() {
  return appStore.get<boolean>(FOCUS_MODE_KEY);
}

export async function writeStoredFocusMode(enabled: boolean) {
  await appStore.set(FOCUS_MODE_KEY, enabled);
  await appStore.save();
}
