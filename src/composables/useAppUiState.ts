import { ref } from 'vue';

export function useAppUiState() {
  const isSidebarOpen = ref(true);
  const isSourceMode = ref(false);
  const sidebarMode = ref<'outline' | 'files'>('outline');
  const imagePasteWarning = ref<string | null>(null);
  const isCommandPaletteOpen = ref(false);
  const isShortcutsModalOpen = ref(false);

  function toggleSidebar() {
    isSidebarOpen.value = !isSidebarOpen.value;
  }

  function toggleSourceMode() {
    isSourceMode.value = !isSourceMode.value;
  }

  function openCommandPalette() {
    isCommandPaletteOpen.value = true;
  }

  function openShortcutsModal() {
    isShortcutsModalOpen.value = true;
  }

  function showImagePasteWarning(message: string) {
    imagePasteWarning.value = message;
    setTimeout(() => {
      imagePasteWarning.value = null;
    }, 3000);
  }

  return {
    isSidebarOpen,
    isSourceMode,
    sidebarMode,
    imagePasteWarning,
    isCommandPaletteOpen,
    isShortcutsModalOpen,
    toggleSidebar,
    toggleSourceMode,
    openCommandPalette,
    openShortcutsModal,
    showImagePasteWarning,
  };
}
