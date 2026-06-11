import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeImageAssetMock: vi.fn(),
  confirmMock: vi.fn(),
  convertFileSrcMock: vi.fn(),
}));

const fileStoreState = {
  currentFile: {
    isDirty: false,
  },
};

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: mocks.confirmMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: mocks.convertFileSrcMock,
}));

vi.mock('../../services/tauri/document', () => ({
  authorizeImageAsset: mocks.authorizeImageAssetMock,
}));

vi.mock('../../stores/file', () => ({
  useFileStore: () => fileStoreState,
}));

describe('useImagePreview', () => {
  beforeEach(() => {
    fileStoreState.currentFile.isDirty = false;
    mocks.authorizeImageAssetMock.mockReset();
    mocks.confirmMock.mockReset();
    mocks.convertFileSrcMock.mockReset();
  });

  it('authorizes image assets before creating preview URLs', async () => {
    mocks.authorizeImageAssetMock.mockResolvedValue({ path: '/canonical/cover.png' });
    mocks.convertFileSrcMock.mockReturnValue('asset://localhost/canonical/cover.png');

    const { useImagePreview } = await import('../useImagePreview');
    const preview = useImagePreview();

    await preview.handleOpenImage('/workspace/cover.png');

    expect(mocks.authorizeImageAssetMock).toHaveBeenCalledWith('/workspace/cover.png');
    expect(mocks.convertFileSrcMock).toHaveBeenCalledWith('/canonical/cover.png');
    expect(preview.activeViewMode.value).toBe('image');
    expect(preview.imagePreviewUrl.value).toBe('asset://localhost/canonical/cover.png');
  });
});
