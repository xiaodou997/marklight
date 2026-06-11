import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TAURI_COMMANDS } from '../command-names';

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  invokeCommand: invokeCommandMock,
}));

describe('tauri document service', () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it('opens documents through the typed command wrapper', async () => {
    const result = {
      path: '/tmp/demo.md',
      content: '# Demo',
      lastModifiedMs: 42,
    };
    invokeCommandMock.mockResolvedValueOnce(result);

    const { openDocument } = await import('../document');

    await expect(openDocument('/tmp/demo.md')).resolves.toBe(result);
    expect(invokeCommandMock).toHaveBeenCalledWith(TAURI_COMMANDS.openDocument, {
      path: '/tmp/demo.md',
    });
  });

  it('saves documents with conflict metadata and force flag', async () => {
    const result = {
      path: '/tmp/demo.md',
      lastModifiedMs: 100,
    };
    invokeCommandMock.mockResolvedValueOnce(result);

    const { saveDocument } = await import('../document');

    await expect(saveDocument('/tmp/demo.md', '# Updated', 99, true)).resolves.toBe(result);
    expect(invokeCommandMock).toHaveBeenCalledWith(TAURI_COMMANDS.saveDocument, {
      path: '/tmp/demo.md',
      content: '# Updated',
      expectedLastModifiedMs: 99,
      force: true,
    });
  });

  it('uses safe save defaults when conflict metadata is omitted', async () => {
    const { saveDocument } = await import('../document');

    await saveDocument('/tmp/demo.md', '# Updated');

    expect(invokeCommandMock).toHaveBeenCalledWith(TAURI_COMMANDS.saveDocument, {
      path: '/tmp/demo.md',
      content: '# Updated',
      expectedLastModifiedMs: undefined,
      force: false,
    });
  });

  it('routes document image operations through their native commands', async () => {
    const { authorizeImageAsset, importDocumentImage, resolveDocumentImagePath } = await import(
      '../document'
    );

    await importDocumentImage('/tmp/image.png', '/tmp/demo.md');
    await resolveDocumentImagePath('/tmp/demo.md', './image.png');
    await authorizeImageAsset('/tmp/image.png');

    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      1,
      TAURI_COMMANDS.importDocumentImage,
      {
        sourcePath: '/tmp/image.png',
        documentPath: '/tmp/demo.md',
      },
    );
    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      2,
      TAURI_COMMANDS.resolveDocumentImagePath,
      {
        documentPath: '/tmp/demo.md',
        relativePath: './image.png',
      },
    );
    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      3,
      TAURI_COMMANDS.authorizeImageAsset,
      {
        path: '/tmp/image.png',
      },
    );
  });

  it('fetches remote images through the native image command', async () => {
    const { fetchRemoteImageData } = await import('../document');

    await fetchRemoteImageData('https://example.com/image.png');

    expect(invokeCommandMock).toHaveBeenCalledWith(TAURI_COMMANDS.fetchRemoteImage, {
      url: 'https://example.com/image.png',
    });
  });
});
