import { beforeEach, describe, expect, it, vi } from 'vitest';

const openMock = vi.fn();
const saveMock = vi.fn();
const confirmMock = vi.fn();
const messageMock = vi.fn();
const openDocumentMock = vi.fn();
const saveDocumentMock = vi.fn();

const fileStoreState = {
  currentFile: {
    path: null as string | null,
    content: '',
    isDirty: false,
    lastModifiedTime: null as number | null,
  },
  setLoading: vi.fn(),
  setFile: vi.fn((content: string, path: string | null, lastModifiedTime: number | null) => {
    fileStoreState.currentFile = {
      path,
      content,
      isDirty: false,
      lastModifiedTime,
    };
  }),
  markSaved: vi.fn((lastModifiedTime: number | null) => {
    fileStoreState.currentFile.isDirty = false;
    fileStoreState.currentFile.lastModifiedTime = lastModifiedTime;
  }),
  reset: vi.fn(),
};

const settingsStoreState = {
  settings: {
    autoSave: false,
    autoSaveInterval: 30,
  },
};

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
  save: saveMock,
  confirm: confirmMock,
  message: messageMock,
}));

vi.mock('../../services/tauri/document', () => ({
  openDocument: openDocumentMock,
  saveDocument: saveDocumentMock,
}));

vi.mock('../../stores/file', () => ({
  useFileStore: () => fileStoreState,
}));

vi.mock('../../stores/settings', () => ({
  useSettingsStore: () => settingsStoreState,
}));

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onUnmounted: vi.fn(),
  };
});

describe('useDocumentSession', () => {
  beforeEach(() => {
    openMock.mockReset();
    saveMock.mockReset();
    confirmMock.mockReset();
    messageMock.mockReset();
    openDocumentMock.mockReset();
    saveDocumentMock.mockReset();
    fileStoreState.currentFile = {
      path: null,
      content: '',
      isDirty: false,
      lastModifiedTime: null,
    };
    fileStoreState.setLoading.mockReset();
    fileStoreState.setFile.mockClear();
    fileStoreState.markSaved.mockClear();
    fileStoreState.reset.mockClear();
  });

  it('loads document content and mtime together', async () => {
    openDocumentMock.mockResolvedValue({
      path: '/tmp/demo.md',
      content: '# title',
      lastModifiedMs: 123,
    });

    const { useDocumentSession } = await import('../useDocumentSession');
    const session = useDocumentSession({
      resetViewMode: vi.fn(),
    });

    await expect(session.loadDocumentFromPath('/tmp/demo.md')).resolves.toBe(true);
    expect(fileStoreState.setLoading).toHaveBeenNthCalledWith(1, true);
    expect(fileStoreState.setLoading).toHaveBeenLastCalledWith(false);
    expect(fileStoreState.setFile).toHaveBeenCalledWith('# title', '/tmp/demo.md', 123);
  });

  it('retries save with force after a document conflict is confirmed', async () => {
    fileStoreState.currentFile = {
      path: '/tmp/demo.md',
      content: 'draft',
      isDirty: true,
      lastModifiedTime: 1000,
    };
    saveDocumentMock
      .mockRejectedValueOnce({ code: 'document_conflict', message: 'conflict' })
      .mockResolvedValueOnce({
        path: '/tmp/demo.md',
        lastModifiedMs: 1500,
      });
    confirmMock.mockResolvedValueOnce(true);

    const { useDocumentSession } = await import('../useDocumentSession');
    const session = useDocumentSession({
      resetViewMode: vi.fn(),
    });

    await expect(session.saveCurrentDocument()).resolves.toBe(true);
    expect(saveDocumentMock).toHaveBeenNthCalledWith(1, '/tmp/demo.md', 'draft', 1000, false);
    expect(saveDocumentMock).toHaveBeenNthCalledWith(2, '/tmp/demo.md', 'draft', 1000, true);
    expect(fileStoreState.markSaved).toHaveBeenCalledWith(1500);
  });

  it('saves a new document through save as', async () => {
    fileStoreState.currentFile = {
      path: null,
      content: 'draft',
      isDirty: true,
      lastModifiedTime: null,
    };
    saveMock.mockResolvedValue('/tmp/demo.md');
    saveDocumentMock.mockResolvedValue({
      path: '/tmp/demo.md',
      lastModifiedMs: 2000,
    });

    const { useDocumentSession } = await import('../useDocumentSession');
    const session = useDocumentSession({
      resetViewMode: vi.fn(),
    });

    await expect(session.saveCurrentDocument()).resolves.toBe(true);
    expect(saveDocumentMock).toHaveBeenCalledWith('/tmp/demo.md', 'draft', null, true);
    expect(fileStoreState.setFile).toHaveBeenCalledWith('draft', '/tmp/demo.md', 2000);
    expect(fileStoreState.markSaved).toHaveBeenCalledWith(2000);
  });
});
