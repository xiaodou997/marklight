import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_EVENT_NAMES } from '../event-names';

const listenMock = vi.fn();

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

describe('tauri event service', () => {
  beforeEach(() => {
    listenMock.mockReset();
  });

  it('listens to app-open-paths payloads without legacy normalization', async () => {
    const handlerRef: { current: ((event: { payload: unknown }) => void) | null } = {
      current: null,
    };
    listenMock.mockImplementationOnce(async (_eventName, handler) => {
      handlerRef.current = handler;
      return () => {};
    });

    const { listenAppOpenPaths } = await import('../events');
    const handler = vi.fn();

    await listenAppOpenPaths(handler);
    handlerRef.current?.({
      payload: {
        paths: ['/tmp/demo.md'],
        source: 'startup',
      },
    });

    expect(listenMock).toHaveBeenCalledWith(APP_EVENT_NAMES.appOpenPaths, expect.any(Function));
    expect(handler).toHaveBeenCalledWith({
      paths: ['/tmp/demo.md'],
      source: 'startup',
    });
  });

  it('listens to workspace-changed payloads with a rootPath field', async () => {
    const handlerRef: { current: ((event: { payload: unknown }) => void) | null } = {
      current: null,
    };
    listenMock.mockImplementationOnce(async (_eventName, handler) => {
      handlerRef.current = handler;
      return () => {};
    });

    const { listenWorkspaceChanged } = await import('../events');
    const handler = vi.fn();

    await listenWorkspaceChanged(handler);
    handlerRef.current?.({
      payload: {
        rootPath: '/tmp/project',
        kind: 'modify',
        paths: ['/tmp/project/demo.md'],
      },
    });

    expect(listenMock).toHaveBeenCalledWith(
      APP_EVENT_NAMES.workspaceChanged,
      expect.any(Function),
    );
    expect(handler).toHaveBeenCalledWith({
      rootPath: '/tmp/project',
      kind: 'modify',
      paths: ['/tmp/project/demo.md'],
    });
  });
});
