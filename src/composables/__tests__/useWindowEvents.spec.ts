import { beforeEach, describe, expect, it, vi } from 'vitest';

const listenMock = vi.fn();
const invokeMock = vi.fn();
const confirmMock = vi.fn();
const destroyMock = vi.fn();

type EventHandler = (event: { payload: unknown }) => void | Promise<void>;

const listeners = new Map<string, EventHandler>();

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: confirmMock,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    destroy: destroyMock,
  }),
}));

describe('useWindowEvents', () => {
  beforeEach(() => {
    listeners.clear();
    listenMock.mockReset();
    listenMock.mockImplementation(async (eventName: string, handler: EventHandler) => {
      listeners.set(eventName, handler);
      return () => {
        listeners.delete(eventName);
      };
    });
    invokeMock.mockReset();
    confirmMock.mockReset();
    destroyMock.mockReset();
  });

  it('consumes pending window file after frontend is ready', async () => {
    const handleOpenFile = vi.fn();
    const handleSave = vi.fn();

    invokeMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce('/tmp/from-new-window.md');

    const { useWindowEvents } = await import('../useWindowEvents');
    const events = useWindowEvents({
      handleOpenFile,
      handleSave,
      isDirty: () => false,
    });

    await events.setup();

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'notify_frontend_ready');
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'consume_pending_window_open_file');
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/from-new-window.md');
  });

  it('falls back to startup-file pull and still consumes pending new-window file', async () => {
    const handleOpenFile = vi.fn();
    const handleSave = vi.fn();

    invokeMock
      .mockRejectedValueOnce(new Error('notify unavailable'))
      .mockResolvedValueOnce('/tmp/startup.md')
      .mockResolvedValueOnce('/tmp/pending.md');

    const { useWindowEvents } = await import('../useWindowEvents');
    const events = useWindowEvents({
      handleOpenFile,
      handleSave,
      isDirty: () => false,
    });

    await events.setup();

    expect(invokeMock).toHaveBeenNthCalledWith(2, 'consume_startup_open_file');
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'consume_pending_window_open_file');
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/startup.md');
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/pending.md');
  });

  it('handles runtime open events from startup push and tauri open payloads', async () => {
    const handleOpenFile = vi.fn();
    const handleSave = vi.fn();

    invokeMock.mockResolvedValue(undefined);

    const { useWindowEvents } = await import('../useWindowEvents');
    const events = useWindowEvents({
      handleOpenFile,
      handleSave,
      isDirty: () => false,
    });

    await events.setup();

    await listeners.get('open-startup-file')?.({ payload: '/tmp/pushed.md' });
    await listeners.get('tauri://open')?.({ payload: ['/tmp/a.md', '/tmp/b.md'] });
    await listeners.get('open-file-in-new-window')?.({ payload: '/tmp/direct.md' });

    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/pushed.md');
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/a.md');
    expect(handleOpenFile).toHaveBeenCalledWith('/tmp/direct.md');
  });

  it('destroys the window after close confirmation and save succeed', async () => {
    const handleOpenFile = vi.fn();
    const handleSave = vi.fn().mockResolvedValue(true);

    invokeMock.mockResolvedValue(undefined);
    confirmMock.mockResolvedValueOnce(true);

    const { useWindowEvents } = await import('../useWindowEvents');
    const events = useWindowEvents({
      handleOpenFile,
      handleSave,
      isDirty: () => true,
    });

    await events.setup();
    await listeners.get('window-close-requested')?.({ payload: null });

    expect(handleSave).toHaveBeenCalled();
    expect(destroyMock).toHaveBeenCalled();
  });
});
