import { computed, nextTick, ref } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useMenuShortcutsSync } from '../useMenuShortcutsSync';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('useMenuShortcutsSync', () => {
  beforeEach(() => {
    invokeMock.mockReset();
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

    expect(invokeMock).toHaveBeenCalledWith('refresh_menu_shortcuts', {
      shortcuts: expect.objectContaining({
        'file.save': 'CmdOrCtrl+Alt+S',
        'view.showFiles': 'CmdOrCtrl+Shift+2',
      }),
    });

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

    expect(invokeMock).not.toHaveBeenCalled();

    await syncMenuShortcuts();
    expect(invokeMock).toHaveBeenCalledTimes(1);

    stopWatching();
  });
});
