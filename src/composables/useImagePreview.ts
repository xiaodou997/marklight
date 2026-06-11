import { ref } from 'vue';
import { useFileStore } from '../stores/file';
import { toAssetUrl } from '../services/tauri/asset';
import { confirm } from '../services/tauri/dialog';
import { authorizeImageAsset } from '../services/tauri/document';

export function useImagePreview() {
  const fileStore = useFileStore();

  const activeViewMode = ref<'editor' | 'image'>('editor');
  const imagePreviewUrl = ref<string | null>(null);
  const isFullscreenPreview = ref(false);

  async function handleOpenImage(path?: string) {
    if (path) {
      if (fileStore.currentFile.isDirty) {
        const confirmed = await confirm('当前文件有未保存的更改，是否放弃更改？', {
          title: '未保存的更改',
          kind: 'warning',
          okLabel: '放弃更改',
          cancelLabel: '取消',
        });
        if (!confirmed) return;
      }
      activeViewMode.value = 'image';
      const authorized = await authorizeImageAsset(path);
      imagePreviewUrl.value = toAssetUrl(authorized.path);
      isFullscreenPreview.value = false;
    } else {
      isFullscreenPreview.value = false;
    }
  }

  function closeFullscreenPreview() {
    isFullscreenPreview.value = false;
  }

  function resetToEditor() {
    activeViewMode.value = 'editor';
    imagePreviewUrl.value = null;
  }

  return {
    activeViewMode,
    imagePreviewUrl,
    isFullscreenPreview,
    handleOpenImage,
    closeFullscreenPreview,
    resetToEditor,
  };
}
