import { beforeEach, describe, expect, it, vi } from 'vitest';

const openMock = vi.fn();
const saveMock = vi.fn();
const confirmMock = vi.fn();
const readDocumentFileMock = vi.fn();
const getDocumentModifiedTimeMock = vi.fn();
const saveDocumentFileMock = vi.fn();
const watchMock = vi.fn((_source, callback, options) => {
  if (options?.immediate) {
    callback([false, 30]);
  }
  return () => {};
});

const fileStoreState = {
  currentFile: {
    path: null as string | null,
    content: '',
    isDirty: false,
    lastModifiedTime: null as number | null,
  },
  isLoading: false,
  setLoading: vi.fn((loading: boolean) => {
    fileStoreState.isLoading = loading;
  }),
  setFile: vi.fn((content: string, path: string | null, lastModifiedTime: number | null = null) => {
    fileStoreState.currentFile = {
      path,
      content,
      isDirty: false,
      lastModifiedTime,
    };
  }),
  markSaved: vi.fn(),
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
}));

vi.mock('vue', () => ({
  watch: watchMock,
}));

vi.mock('../../services/tauri/file-system', () => ({
  readDocumentFile: readDocumentFileMock,
  getDocumentModifiedTime: getDocumentModifiedTimeMock,
  saveDocumentFile: saveDocumentFileMock,
}));

vi.mock('../../stores/file', () => ({
  useFileStore: () => fileStoreState,
}));

vi.mock('../../stores/settings', () => ({
  useSettingsStore: () => settingsStoreState,
}));

describe('useFileOperations', () => {
  beforeEach(() => {
    openMock.mockReset();
    saveMock.mockReset();
    confirmMock.mockReset();
    readDocumentFileMock.mockReset();
    getDocumentModifiedTimeMock.mockReset();
    saveDocumentFileMock.mockReset();
    watchMock.mockClear();
    fileStoreState.currentFile = {
      path: null,
      content: '',
      isDirty: false,
      lastModifiedTime: null,
    };
    fileStoreState.isLoading = false;
    fileStoreState.setLoading.mockClear();
    fileStoreState.setFile.mockClear();
    fileStoreState.markSaved.mockClear();
    fileStoreState.reset.mockClear();
    settingsStoreState.settings.autoSave = false;
    settingsStoreState.settings.autoSaveInterval = 30;
  });

  it('loadFileFromPath loads file content and mtime together', async () => {
    readDocumentFileMock.mockResolvedValueOnce('# title');
    getDocumentModifiedTimeMock.mockResolvedValueOnce(123);

    const { useFileOperations } = await import('../useFileOperations');
    const { loadFileFromPath } = useFileOperations();

    await expect(loadFileFromPath('/tmp/demo.md')).resolves.toBe(true);
    expect(fileStoreState.setLoading).toHaveBeenNthCalledWith(1, true);
    expect(fileStoreState.setLoading).toHaveBeenLastCalledWith(false);
    expect(readDocumentFileMock).toHaveBeenCalledWith('/tmp/demo.md');
    expect(getDocumentModifiedTimeMock).toHaveBeenCalledWith('/tmp/demo.md');
    expect(fileStoreState.setFile).toHaveBeenCalledWith('# title', '/tmp/demo.md', 123);
  });

  it('handleOpen uses the shared file loader', async () => {
    openMock.mockResolvedValue('/tmp/opened.md');
    readDocumentFileMock.mockResolvedValueOnce('opened content');
    getDocumentModifiedTimeMock.mockResolvedValueOnce(456);

    const { useFileOperations } = await import('../useFileOperations');
    const { handleOpen } = useFileOperations();

    await handleOpen();

    expect(openMock).toHaveBeenCalled();
    expect(fileStoreState.setFile).toHaveBeenCalledWith('opened content', '/tmp/opened.md', 456);
  });

  it('handleSave rejects overwrite when external mtime is newer', async () => {
    fileStoreState.currentFile = {
      path: '/tmp/demo.md',
      content: 'draft',
      isDirty: true,
      lastModifiedTime: 1000,
    };
    getDocumentModifiedTimeMock.mockResolvedValueOnce(1001);
    confirmMock.mockResolvedValue(false);

    const { useFileOperations } = await import('../useFileOperations');
    const { handleSave } = useFileOperations();

    await expect(handleSave()).resolves.toBe(false);
    expect(getDocumentModifiedTimeMock).toHaveBeenCalledTimes(1);
    expect(getDocumentModifiedTimeMock).toHaveBeenCalledWith('/tmp/demo.md');
    expect(confirmMock).toHaveBeenCalled();
    expect(fileStoreState.markSaved).not.toHaveBeenCalled();
  });

  it('handleSave persists file and refreshes mtime after save', async () => {
    fileStoreState.currentFile = {
      path: '/tmp/demo.md',
      content: 'draft',
      isDirty: true,
      lastModifiedTime: 1000,
    };
    getDocumentModifiedTimeMock.mockResolvedValueOnce(1000).mockResolvedValueOnce(1500);
    saveDocumentFileMock.mockResolvedValueOnce(undefined);

    const { useFileOperations } = await import('../useFileOperations');
    const { handleSave } = useFileOperations();

    await expect(handleSave()).resolves.toBe(true);
    expect(getDocumentModifiedTimeMock).toHaveBeenNthCalledWith(1, '/tmp/demo.md');
    expect(saveDocumentFileMock).toHaveBeenCalledWith('/tmp/demo.md', 'draft');
    expect(getDocumentModifiedTimeMock).toHaveBeenNthCalledWith(2, '/tmp/demo.md');
    expect(fileStoreState.markSaved).toHaveBeenCalledWith(1500);
  });
});
