import { invoke } from '@tauri-apps/api/core';
import { watch, type Ref } from 'vue';
import { getMenuShortcuts } from '../utils/shortcuts';

export interface MenuShortcutSyncOptions {
  customShortcuts: Ref<Record<string, string>>;
  isLoaded: Ref<boolean>;
}

export function useMenuShortcutsSync(options: MenuShortcutSyncOptions) {
  async function syncMenuShortcuts() {
    await invoke('refresh_menu_shortcuts', {
      shortcuts: getMenuShortcuts(options.customShortcuts.value),
    });
  }

  const stopWatching = watch(
    options.customShortcuts,
    () => {
      if (!options.isLoaded.value) {
        return;
      }
      void syncMenuShortcuts();
    },
    { deep: true },
  );

  return {
    syncMenuShortcuts,
    stopWatching,
  };
}
