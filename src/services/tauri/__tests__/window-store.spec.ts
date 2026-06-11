import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TAURI_COMMANDS } from '../command-names';

const mocks = vi.hoisted(() => {
  const window = {
    setTitle: vi.fn(),
    destroy: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    isFullscreen: vi.fn(),
    setFullscreen: vi.fn(),
    setTheme: vi.fn(),
  };

  return {
    window,
    getCurrentWindow: vi.fn(() => window),
    invokeCommand: vi.fn(),
    saveWindowState: vi.fn(),
    storeGet: vi.fn(),
    storeSet: vi.fn(),
    storeSave: vi.fn(),
    lazyStoreConstructor: vi.fn(),
  };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: mocks.getCurrentWindow,
}));

vi.mock('@tauri-apps/plugin-window-state', () => ({
  saveWindowState: mocks.saveWindowState,
  StateFlags: {
    SIZE: 1,
    POSITION: 2,
    MAXIMIZED: 4,
    FULLSCREEN: 8,
  },
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    constructor(path: string, options: unknown) {
      mocks.lazyStoreConstructor(path, options);
    }

    get<T>(key: string): Promise<T | undefined> {
      return mocks.storeGet(key);
    }

    set(key: string, value: unknown): Promise<void> {
      return mocks.storeSet(key, value);
    }

    save(): Promise<void> {
      return mocks.storeSave();
    }
  },
}));

vi.mock('../client', () => ({
  invokeCommand: mocks.invokeCommand,
}));

describe('tauri window service', () => {
  beforeEach(() => {
    Object.values(mocks.window).forEach((mock) => mock.mockReset());
    mocks.getCurrentWindow.mockClear();
    mocks.invokeCommand.mockReset();
  });

  it('routes current window operations through the window API', async () => {
    mocks.window.isFullscreen.mockResolvedValueOnce(false);

    const {
      destroyCurrentWindow,
      isCurrentWindowFullscreen,
      minimizeCurrentWindow,
      setCurrentWindowFullscreen,
      setCurrentWindowTheme,
      setCurrentWindowTitle,
      toggleCurrentWindowMaximize,
    } = await import('../window');

    await setCurrentWindowTitle('Demo');
    await minimizeCurrentWindow();
    await toggleCurrentWindowMaximize();
    await expect(isCurrentWindowFullscreen()).resolves.toBe(false);
    await setCurrentWindowFullscreen(true);
    await setCurrentWindowTheme('dark');
    await destroyCurrentWindow();

    expect(mocks.window.setTitle).toHaveBeenCalledWith('Demo');
    expect(mocks.window.minimize).toHaveBeenCalledWith();
    expect(mocks.window.toggleMaximize).toHaveBeenCalledWith();
    expect(mocks.window.isFullscreen).toHaveBeenCalledWith();
    expect(mocks.window.setFullscreen).toHaveBeenCalledWith(true);
    expect(mocks.window.setTheme).toHaveBeenCalledWith('dark');
    expect(mocks.window.destroy).toHaveBeenCalledWith();
  });

  it('routes native window commands through the command wrapper', async () => {
    const {
      consumeStartupOpenRequest,
      consumeWindowOpenRequest,
      notifyFrontendReady,
      openEditorWindow,
      printDocument,
      refreshNativeMenuShortcuts,
      revealStartupOpenLog,
      setCurrentWindowBackgroundColor,
    } = await import('../window');

    await setCurrentWindowBackgroundColor('#ffffff');
    await openEditorWindow('/tmp/demo.md');
    await printDocument();
    await refreshNativeMenuShortcuts({ 'file.save': 'CmdOrCtrl+S' });
    await revealStartupOpenLog();
    await consumeStartupOpenRequest();
    await notifyFrontendReady();
    await consumeWindowOpenRequest();

    expect(mocks.invokeCommand).toHaveBeenNthCalledWith(
      1,
      TAURI_COMMANDS.setWindowBackgroundColor,
      { color: '#ffffff' },
    );
    expect(mocks.invokeCommand).toHaveBeenNthCalledWith(2, TAURI_COMMANDS.openEditorWindow, {
      path: '/tmp/demo.md',
    });
    expect(mocks.invokeCommand).toHaveBeenNthCalledWith(3, TAURI_COMMANDS.printDocument);
    expect(mocks.invokeCommand).toHaveBeenNthCalledWith(
      4,
      TAURI_COMMANDS.refreshNativeMenuShortcuts,
      { shortcuts: { 'file.save': 'CmdOrCtrl+S' } },
    );
    expect(mocks.invokeCommand).toHaveBeenNthCalledWith(5, TAURI_COMMANDS.revealStartupOpenLog);
    expect(mocks.invokeCommand).toHaveBeenNthCalledWith(
      6,
      TAURI_COMMANDS.consumeStartupOpenRequest,
    );
    expect(mocks.invokeCommand).toHaveBeenNthCalledWith(7, TAURI_COMMANDS.notifyFrontendReady);
    expect(mocks.invokeCommand).toHaveBeenNthCalledWith(
      8,
      TAURI_COMMANDS.consumeWindowOpenRequest,
    );
  });
});

describe('tauri store service', () => {
  beforeEach(() => {
    mocks.storeGet.mockReset();
    mocks.storeSet.mockReset();
    mocks.storeSave.mockReset();
    mocks.lazyStoreConstructor.mockClear();
  });

  it('initializes the settings store with the app settings file', async () => {
    await import('../store');

    expect(mocks.lazyStoreConstructor).toHaveBeenCalledWith('settings.json', {
      defaults: {},
      autoSave: false,
    });
  });

  it('reads and writes persisted settings through LazyStore', async () => {
    const settings = { theme: 'light' };
    mocks.storeGet.mockResolvedValueOnce(settings);

    const { readStoredSettings, writeStoredSettings } = await import('../store');

    await expect(readStoredSettings()).resolves.toBe(settings);
    await writeStoredSettings(settings);

    expect(mocks.storeGet).toHaveBeenCalledWith('settings');
    expect(mocks.storeSet).toHaveBeenCalledWith('settings', settings);
    expect(mocks.storeSave).toHaveBeenCalledWith();
  });

  it('reads and writes persisted focus mode through LazyStore', async () => {
    mocks.storeGet.mockResolvedValueOnce(true);

    const { readStoredFocusMode, writeStoredFocusMode } = await import('../store');

    await expect(readStoredFocusMode()).resolves.toBe(true);
    await writeStoredFocusMode(false);

    expect(mocks.storeGet).toHaveBeenCalledWith('focusMode');
    expect(mocks.storeSet).toHaveBeenCalledWith('focusMode', false);
    expect(mocks.storeSave).toHaveBeenCalledWith();
  });
});

describe('tauri window state service', () => {
  beforeEach(() => {
    mocks.saveWindowState.mockReset();
  });

  it('saves all current window state flags', async () => {
    const { saveAllWindowState } = await import('../window-state');

    await saveAllWindowState();

    expect(mocks.saveWindowState).toHaveBeenCalledWith(15);
  });
});
