import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const openMock = vi.fn();
const saveMock = vi.fn();
const confirmMock = vi.fn();
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

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
  save: saveMock,
  confirm: confirmMock,
}));

vi.mock('vue', () => ({
  watch: watchMock,
}));

vi.mock('../../stores/file', () => ({
  useFileStore: () => fileStoreState,
}));

vi.mock('../../stores/settings', () => ({
  useSettingsStore: () => settingsStoreState,
}));

describe('useFileOperations', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
    saveMock.mockReset();
    confirmMock.mockReset();
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
    invokeMock
      .mockResolvedValueOnce('# title')
      .mockResolvedValueOnce(123);

    const { useFileOperations } = await import('../useFileOperations');
    const { loadFileFromPath } = useFileOperations();

    await expect(loadFileFromPath('/tmp/demo.md')).resolves.toBe(true);
    expect(fileStoreState.setLoading).toHaveBeenNthCalledWith(1, true);
    expect(fileStoreState.setLoading).toHaveBeenLastCalledWith(false);
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'read_file', { path: '/tmp/demo.md' });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'get_file_modified_time', { path: '/tmp/demo.md' });
    expect(fileStoreState.setFile).toHaveBeenCalledWith('# title', '/tmp/demo.md', 123);
  });

  it('handleOpen uses the shared file loader', async () => {
    openMock.mockResolvedValue('/tmp/opened.md');
    invokeMock
      .mockResolvedValueOnce('opened content')
      .mockResolvedValueOnce(456);

    const { useFileOperations } = await import('../useFileOperations');
    const { handleOpen } = useFileOperations();

    await handleOpen();

    expect(openMock).toHaveBeenCalled();
    expect(fileStoreState.setFile).toHaveBeenCalledWith('opened content', '/tmp/opened.md', 456);
  });
});
