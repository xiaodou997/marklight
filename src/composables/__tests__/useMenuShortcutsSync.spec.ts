import { computed, nextTick, ref } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useMenuShortcutsSync } from '../useMenuShortcutsSync';

const { refreshNativeMenuShortcutsMock } = vi.hoisted(() => ({
  refreshNativeMenuShortcutsMock: vi.fn(),
}));

vi.mock('../../services/tauri/window', () => ({
  refreshNativeMenuShortcuts: refreshNativeMenuShortcutsMock,
}));

describe('useMenuShortcutsSync', () => {
  beforeEach(() => {
    refreshNativeMenuShortcutsMock.mockReset();
  });

  it('syncs effective shortcuts to the native menu', async () => {
    const customShortcuts = ref<Record<string, string>>({});
    const isLoaded = ref(true);
    const { stopWatching } = useMenuShortcutsSync({
      customShortcuts: computed(() => customShortcuts.value),
      isLoaded,
    });

    customShortcuts.value = {
      'file.save': 'Mod-Alt-s',
      'view.showFiles': 'Mod-Shift-2',
    };
    await nextTick();

    expect(refreshNativeMenuShortcutsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        'file.save': 'CmdOrCtrl+Alt+S',
        'view.showFiles': 'CmdOrCtrl+Shift+2',
      }),
    );

    stopWatching();
  });

  it('does not sync before settings are loaded', async () => {
    const customShortcuts = ref<Record<string, string>>({});
    const isLoaded = ref(false);
    const { stopWatching, syncMenuShortcuts } = useMenuShortcutsSync({
      customShortcuts: computed(() => customShortcuts.value),
      isLoaded,
    });

    customShortcuts.value = { 'file.save': 'Mod-Alt-s' };
    await nextTick();

    expect(refreshNativeMenuShortcutsMock).not.toHaveBeenCalled();

    await syncMenuShortcuts();
    expect(refreshNativeMenuShortcutsMock).toHaveBeenCalledTimes(1);

    stopWatching();
  });
});
