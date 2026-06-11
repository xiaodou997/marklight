import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  message: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
  writeHtml: vi.fn(),
  openUrl: vi.fn(),
  platform: vi.fn(),
  convertFileSrc: vi.fn(),
  onDragDropEvent: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: mocks.confirm,
  message: mocks.message,
  open: mocks.open,
  save: mocks.save,
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeHtml: mocks.writeHtml,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: mocks.openUrl,
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: mocks.platform,
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: mocks.convertFileSrc,
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: mocks.onDragDropEvent,
  }),
}));

describe('tauri plugin service wrappers', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it('routes dialog calls through the dialog plugin', async () => {
    mocks.confirm.mockResolvedValueOnce(true);
    mocks.message.mockResolvedValueOnce(undefined);
    mocks.open.mockResolvedValueOnce('/tmp/demo.md');
    mocks.save.mockResolvedValueOnce('/tmp/export.html');

    const dialog = await import('../dialog');

    await expect(dialog.confirm('Discard?', { title: 'Confirm' })).resolves.toBe(true);
    await dialog.message('Done', { title: 'Status' });
    await expect(dialog.open({ multiple: false })).resolves.toBe('/tmp/demo.md');
    await expect(dialog.save({ defaultPath: 'export.html' })).resolves.toBe('/tmp/export.html');

    expect(mocks.confirm).toHaveBeenCalledWith('Discard?', { title: 'Confirm' });
    expect(mocks.message).toHaveBeenCalledWith('Done', { title: 'Status' });
    expect(mocks.open).toHaveBeenCalledWith({ multiple: false });
    expect(mocks.save).toHaveBeenCalledWith({ defaultPath: 'export.html' });
  });

  it('routes clipboard html writes through the clipboard plugin', async () => {
    const { writeHtml } = await import('../clipboard');

    await writeHtml('<strong>Demo</strong>', 'Demo');

    expect(mocks.writeHtml).toHaveBeenCalledWith('<strong>Demo</strong>', 'Demo');
  });

  it('routes URL opening through the opener plugin', async () => {
    const { openUrl } = await import('../opener');

    await openUrl('https://example.com');

    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('routes platform detection through the os plugin', async () => {
    mocks.platform.mockReturnValueOnce('macos');

    const { platform } = await import('../os');

    expect(platform()).toBe('macos');
    expect(mocks.platform).toHaveBeenCalledWith();
  });

  it('converts file paths through the asset helper', async () => {
    mocks.convertFileSrc.mockReturnValueOnce('asset://localhost/demo.png');

    const { toAssetUrl } = await import('../asset');

    expect(toAssetUrl('/tmp/demo.png')).toBe('asset://localhost/demo.png');
    expect(mocks.convertFileSrc).toHaveBeenCalledWith('/tmp/demo.png');
  });

  it('subscribes to current webview drag-drop events', async () => {
    const unlisten = vi.fn();
    const handler = vi.fn();
    mocks.onDragDropEvent.mockResolvedValueOnce(unlisten);

    const { listenCurrentWebviewDragDrop } = await import('../webview');

    await expect(listenCurrentWebviewDragDrop(handler)).resolves.toBe(unlisten);
    expect(mocks.onDragDropEvent).toHaveBeenCalledWith(handler);
  });
});
