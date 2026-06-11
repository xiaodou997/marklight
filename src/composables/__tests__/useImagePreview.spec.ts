import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeImageAssetMock: vi.fn(),
  confirmMock: vi.fn(),
  toAssetUrlMock: vi.fn(),
}));

const fileStoreState = {
  currentFile: {
    isDirty: false,
  },
};

vi.mock('../../services/tauri/dialog', () => ({
  confirm: mocks.confirmMock,
}));

vi.mock('../../services/tauri/asset', () => ({
  toAssetUrl: mocks.toAssetUrlMock,
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
    mocks.toAssetUrlMock.mockReset();
  });

  it('authorizes image assets before creating preview URLs', async () => {
    mocks.authorizeImageAssetMock.mockResolvedValue({ path: '/canonical/cover.png' });
    mocks.toAssetUrlMock.mockReturnValue('asset://localhost/canonical/cover.png');

    const { useImagePreview } = await import('../useImagePreview');
    const preview = useImagePreview();

    await preview.handleOpenImage('/workspace/cover.png');

    expect(mocks.authorizeImageAssetMock).toHaveBeenCalledWith('/workspace/cover.png');
    expect(mocks.toAssetUrlMock).toHaveBeenCalledWith('/canonical/cover.png');
    expect(preview.activeViewMode.value).toBe('image');
    expect(preview.imagePreviewUrl.value).toBe('asset://localhost/canonical/cover.png');
  });
});
