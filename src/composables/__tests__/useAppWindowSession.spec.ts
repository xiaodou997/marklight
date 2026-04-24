import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { APP_EVENT_NAMES } from '../../services/tauri/event-names';

const confirmMock = vi.fn();
const consumeStartupOpenRequestMock = vi.fn();
const consumeWindowOpenRequestMock = vi.fn();
const destroyCurrentWindowMock = vi.fn();
const isCurrentWindowFullscreenMock = vi.fn();
const openEditorWindowMock = vi.fn();
const setCurrentWindowFullscreenMock = vi.fn();
const setCurrentWindowTitleMock = vi.fn();
const saveAllWindowStateMock = vi.fn();
const onDragDropEventMock = vi.fn();
const listeners = new Map<string, (payload: unknown) => void | Promise<void>>();

function createListenerMock(eventName: string) {
  return vi.fn(async (handler: (payload: unknown) => void | Promise<void>) => {
    listeners.set(eventName, handler);
    return () => {
      listeners.delete(eventName);
    };
  });
}

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: confirmMock,
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: onDragDropEventMock,
  }),
}));

vi.mock('../../services/tauri/events', () => ({
  listenAppOpenPaths: createListenerMock(APP_EVENT_NAMES.appOpenPaths),
  listenWindowCloseRequested: createListenerMock(APP_EVENT_NAMES.windowCloseRequested),
}));

vi.mock('../../services/tauri/window', () => ({
  consumeStartupOpenRequest: consumeStartupOpenRequestMock,
  consumeWindowOpenRequest: consumeWindowOpenRequestMock,
  destroyCurrentWindow: destroyCurrentWindowMock,
  isCurrentWindowFullscreen: isCurrentWindowFullscreenMock,
  openEditorWindow: openEditorWindowMock,
  setCurrentWindowFullscreen: setCurrentWindowFullscreenMock,
  setCurrentWindowTitle: setCurrentWindowTitleMock,
}));

vi.mock('../../services/tauri/window-state', () => ({
  saveAllWindowState: saveAllWindowStateMock,
}));

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onUnmounted: vi.fn(),
  };
});

describe('useAppWindowSession', () => {
  beforeEach(() => {
    listeners.clear();
    confirmMock.mockReset();
    consumeStartupOpenRequestMock.mockReset();
    consumeWindowOpenRequestMock.mockReset();
    destroyCurrentWindowMock.mockReset();
    isCurrentWindowFullscreenMock.mockReset();
    openEditorWindowMock.mockReset();
    setCurrentWindowFullscreenMock.mockReset();
    setCurrentWindowTitleMock.mockReset();
    setCurrentWindowTitleMock.mockResolvedValue(undefined);
    saveAllWindowStateMock.mockReset();
    saveAllWindowStateMock.mockResolvedValue(undefined);
    onDragDropEventMock.mockReset();
    onDragDropEventMock.mockResolvedValue(() => {});
  });

  it('consumes startup and new-window open requests on setup', async () => {
    const openDocument = vi.fn();
    consumeStartupOpenRequestMock.mockResolvedValue({
      paths: ['/tmp/startup.md'],
      source: 'startup',
    });
    consumeWindowOpenRequestMock.mockResolvedValue({
      paths: ['/tmp/window.md'],
      source: 'new-window',
    });

    const { useAppWindowSession } = await import('../useAppWindowSession');
    const session = useAppWindowSession({
      openDocument,
      saveDocument: vi.fn(),
      isDirty: () => false,
      windowTitle: ref('Demo'),
    });

    await session.setup();

    expect(setCurrentWindowTitleMock).toHaveBeenCalledWith('Demo');
    expect(openDocument).toHaveBeenCalledWith('/tmp/startup.md');
    expect(openDocument).toHaveBeenCalledWith('/tmp/window.md');
    expect(onDragDropEventMock).toHaveBeenCalled();
  });

  it('saves and closes after a close request confirms save', async () => {
    const saveDocument = vi.fn().mockResolvedValue(true);
    consumeStartupOpenRequestMock.mockResolvedValue(null);
    consumeWindowOpenRequestMock.mockResolvedValue(null);
    confirmMock.mockResolvedValueOnce(true);

    const { useAppWindowSession } = await import('../useAppWindowSession');
    const session = useAppWindowSession({
      openDocument: vi.fn(),
      saveDocument,
      isDirty: () => true,
      windowTitle: ref('Dirty'),
    });

    await session.setup();
    await listeners.get(APP_EVENT_NAMES.windowCloseRequested)?.(null);

    expect(saveDocument).toHaveBeenCalled();
    expect(saveAllWindowStateMock).toHaveBeenCalled();
    expect(destroyCurrentWindowMock).toHaveBeenCalled();
  });
});
