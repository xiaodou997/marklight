import { watch, type Ref } from 'vue';
import { refreshNativeMenuShortcuts } from '../services/tauri/window';
import { getMenuShortcuts } from '../utils/shortcuts';

export interface MenuShortcutSyncOptions {
  customShortcuts: Ref<Record<string, string>>;
  isLoaded: Ref<boolean>;
}

export function useMenuShortcutsSync(options: MenuShortcutSyncOptions) {
  async function syncMenuShortcuts() {
    await refreshNativeMenuShortcuts(getMenuShortcuts(options.customShortcuts.value));
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
