import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_EVENT_NAMES } from '../event-names';

const listenMock = vi.fn();
const emitMock = vi.fn();

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
  emit: emitMock,
}));

describe('tauri event service', () => {
  beforeEach(() => {
    listenMock.mockReset();
    emitMock.mockReset();
  });

  it('normalizes tauri open string payloads to path arrays', async () => {
    const handlerRef: { current: ((event: { payload: unknown }) => void) | null } = {
      current: null,
    };
    listenMock.mockImplementationOnce(async (_eventName, handler) => {
      handlerRef.current = handler;
      return () => {};
    });

    const { listenTauriOpen } = await import('../events');
    const handler = vi.fn();

    await listenTauriOpen(handler);
    const registeredHandler = handlerRef.current;
    if (registeredHandler) {
      registeredHandler({ payload: '/tmp/demo.md' });
    }

    expect(listenMock).toHaveBeenCalledWith(APP_EVENT_NAMES.tauriOpen, expect.any(Function));
    expect(handler).toHaveBeenCalledWith(['/tmp/demo.md']);
  });

  it('normalizes tauri open object payloads to path arrays', async () => {
    const handlerRef: { current: ((event: { payload: unknown }) => void) | null } = {
      current: null,
    };
    listenMock.mockImplementationOnce(async (_eventName, handler) => {
      handlerRef.current = handler;
      return () => {};
    });

    const { listenTauriOpen } = await import('../events');
    const handler = vi.fn();

    await listenTauriOpen(handler);
    const registeredHandler = handlerRef.current;
    if (registeredHandler) {
      registeredHandler({ payload: { paths: ['/tmp/a.md', '/tmp/b.md'] } });
    }

    expect(handler).toHaveBeenCalledWith(['/tmp/a.md', '/tmp/b.md']);
  });

  it('uses centralized event names for menu emits', async () => {
    const { emitMenuEvent } = await import('../events');

    await emitMenuEvent('file.save');

    expect(emitMock).toHaveBeenCalledWith(APP_EVENT_NAMES.menu, 'file.save');
  });
});
