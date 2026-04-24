import { beforeEach, describe, expect, it, vi } from 'vitest';

const listenOpenFileArgsMock = vi.fn();
const listenOpenFileInNewWindowMock = vi.fn();
const listenStartupFileMock = vi.fn();
const listenTauriOpenMock = vi.fn();
const listenWindowCloseRequestedMock = vi.fn();
const consumePendingWindowOpenFileMock = vi.fn();
const consumeStartupOpenFileMock = vi.fn();
const destroyCurrentWindowMock = vi.fn();
const notifyFrontendReadyMock = vi.fn();
const saveAllWindowStateMock = vi.fn();
const confirmMock = vi.fn();

const listeners = new Map<string, (payload: unknown) => void | Promise<void>>();

function createListenerMock(eventName: string) {
  return vi.fn(async (handler: (payload: unknown) => void | Promise<void>) => {
    listeners.set(eventName, handler);
    return () => {
      listeners.delete(eventName);
    };
  });
}

vi.mock('../../services/tauri/events', () => ({
  listenOpenFileArgs: listenOpenFileArgsMock,
  listenOpenFileInNewWindow: listenOpenFileInNewWindowMock,
  listenStartupFile: listenStartupFileMock,
  listenTauriOpen: listenTauriOpenMock,
  listenWindowCloseRequested: listenWindowCloseRequestedMock,
}));

vi.mock('../../services/tauri/window', () => ({
  consumePendingWindowOpenFile: consumePendingWindowOpenFileMock,
  consumeStartupOpenFile: consumeStartupOpenFileMock,
  destroyCurrentWindow: destroyCurrentWindowMock,
  notifyFrontendReady: notifyFrontendReadyMock,
}));

vi.mock('../../services/tauri/window-state', () => ({
  saveAllWindowState: saveAllWindowStateMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: confirmMock,
}));

describe('useWindowEvents', () => {
  beforeEach(() => {
    listeners.clear();
    listenOpenFileArgsMock.mockImplementation(createListenerMock('open-file-args'));
    listenOpenFileInNewWindowMock.mockImplementation(createListenerMock('open-file-in-new-window'));
    listenStartupFileMock.mockImplementation(createListenerMock('open-startup-file'));
    listenTauriOpenMock.mockImplementation(createListenerMock('tauri://open'));
    listenWindowCloseRequestedMock.mockImplementation(createListenerMock('window-close-requested'));
    consumePendingWindowOpenFileMock.mockReset();
    consumeStartupOpenFileMock.mockReset();
    destroyCurrentWindowMock.mockReset();
    notifyFrontendReadyMock.mockReset();
    saveAllWindowStateMock.mockReset();
    saveAllWindowStateMock.mockResolvedValue(undefined);
    confirmMock.mockReset();
  });

  it('consumes pending window file after frontend is ready', async () => {
    const handleOpenFile = vi.fn();
    const handleSave = vi.fn();

    notifyFrontendReadyMock.mockResolvedValueOnce(undefined);
    consumePendingWindowOpenFileMock.mockResolvedValueOnce('/tmp/from-new-window.md');

    const { useWindowEvents } = await import('../useWindowEvents');
    const events = useWindowEvents({
      handleOpenFile,
      handleSave,
      isDirty: () => false,
    });

    await events.setup();

    expect(notifyFrontendReadyMock).toHaveBeenCalled();
    expect(consumePendingWindowOpenFileMock).toHaveBeenCalled();
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/from-new-window.md');
  });

  it('falls back to startup-file pull and still consumes pending new-window file', async () => {
    const handleOpenFile = vi.fn();
    const handleSave = vi.fn();

    notifyFrontendReadyMock.mockRejectedValueOnce(new Error('notify unavailable'));
    consumeStartupOpenFileMock.mockResolvedValueOnce('/tmp/startup.md');
    consumePendingWindowOpenFileMock.mockResolvedValueOnce('/tmp/pending.md');

    const { useWindowEvents } = await import('../useWindowEvents');
    const events = useWindowEvents({
      handleOpenFile,
      handleSave,
      isDirty: () => false,
    });

    await events.setup();

    expect(consumeStartupOpenFileMock).toHaveBeenCalled();
    expect(consumePendingWindowOpenFileMock).toHaveBeenCalled();
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/startup.md');
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/pending.md');
  });

  it('handles runtime open events from startup push and tauri open payloads', async () => {
    const handleOpenFile = vi.fn();
    const handleSave = vi.fn();

    notifyFrontendReadyMock.mockResolvedValue(undefined);
    consumePendingWindowOpenFileMock.mockResolvedValue(null);

    const { useWindowEvents } = await import('../useWindowEvents');
    const events = useWindowEvents({
      handleOpenFile,
      handleSave,
      isDirty: () => false,
    });

    await events.setup();

    await listeners.get('open-startup-file')?.('/tmp/pushed.md');
    await listeners.get('tauri://open')?.(['/tmp/a.md', '/tmp/b.md']);
    await listeners.get('open-file-in-new-window')?.('/tmp/direct.md');

    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/pushed.md');
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/a.md');
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/direct.md');
  });

  it('destroys the window after close confirmation and save succeed', async () => {
    const handleOpenFile = vi.fn();
    const handleSave = vi.fn().mockResolvedValue(true);

    notifyFrontendReadyMock.mockResolvedValue(undefined);
    consumePendingWindowOpenFileMock.mockResolvedValue(null);
    confirmMock.mockResolvedValueOnce(true);

    const { useWindowEvents } = await import('../useWindowEvents');
    const events = useWindowEvents({
      handleOpenFile,
      handleSave,
      isDirty: () => true,
    });

    await events.setup();
    await listeners.get('window-close-requested')?.(null);

    expect(handleSave).toHaveBeenCalled();
    expect(saveAllWindowStateMock).toHaveBeenCalled();
    expect(destroyCurrentWindowMock).toHaveBeenCalled();
  });
});
