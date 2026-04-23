import { describe, expect, it, vi } from 'vitest';
import { useCommandDispatcher } from '../useCommandDispatcher';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

function createDispatcher() {
  const editorExecute = vi.fn();
  const hasFocus = vi.fn(() => true);
  const openSearch = vi.fn();
  const handleNew = vi.fn();
  const handleOpen = vi.fn();
  const handleOpenFolder = vi.fn();
  const handleSave = vi.fn();
  const handleSaveAs = vi.fn();
  const handleOpenNewWindow = vi.fn();
  const exportHtml = vi.fn();
  const exportPdf = vi.fn();
  const copyToWechat = vi.fn();
  const toggleSidebar = vi.fn();
  const toggleSourceMode = vi.fn();
  const openSettings = vi.fn();
  const openCommandPalette = vi.fn();
  const openShortcuts = vi.fn();
  const toggleFocusMode = vi.fn();
  const showAbout = vi.fn();
  const toggleFullscreen = vi.fn();
  const handleQuit = vi.fn();

  const activeViewMode = { value: 'editor' as const };
  const isSourceMode = { value: false };
  const isSidebarOpen = { value: false };
  const sidebarMode = { value: 'outline' as const };

  const dispatcher = useCommandDispatcher({
    editorRef: {
      value: {
        executeCommand: editorExecute,
        hasFocus,
        openSearch,
      },
    },
    activeViewMode,
    isSourceMode,
    isSidebarOpen,
    sidebarMode,
    handleNew,
    handleOpen,
    handleOpenFolder,
    handleSave,
    handleSaveAs,
    handleOpenNewWindow,
    exportHtml,
    exportPdf,
    copyToWechat,
    toggleSidebar,
    toggleSourceMode,
    openSettings,
    openCommandPalette,
    openShortcuts,
    toggleFocusMode,
    showAbout,
    toggleFullscreen,
    handleQuit,
  });

  return {
    dispatcher,
    spies: {
      editorExecute,
      hasFocus,
      openSearch,
      handleNew,
      toggleSidebar,
      openCommandPalette,
    },
    state: {
      activeViewMode,
      isSourceMode,
      isSidebarOpen,
      sidebarMode,
    },
  };
}

describe('useCommandDispatcher', () => {
  it('runs app commands through shared handlers', async () => {
    const { dispatcher, spies } = createDispatcher();

    await expect(dispatcher.executeCommand('file.new', 'menu')).resolves.toBe(true);
    expect(spies.handleNew).toHaveBeenCalled();
  });

  it('blocks editor shortcuts when editor is not focused', async () => {
    const { dispatcher, spies } = createDispatcher();
    spies.hasFocus.mockReturnValue(false);

    await expect(dispatcher.executeCommand('editor.bold', 'shortcut')).resolves.toBe(false);
    expect(spies.editorExecute).not.toHaveBeenCalled();
  });

  it('executes editor commands when focus gate passes', async () => {
    const { dispatcher, spies } = createDispatcher();
    spies.editorExecute.mockReturnValue(true);

    await expect(dispatcher.executeCommand('editor.bold', 'shortcut')).resolves.toBe(true);
    expect(spies.editorExecute).toHaveBeenCalledWith('editor.bold');
  });

  it('switches sidebar mode through shared app command path', async () => {
    const { dispatcher, state } = createDispatcher();

    await expect(dispatcher.executeCommand('view.showFiles', 'palette')).resolves.toBe(true);
    expect(state.sidebarMode.value).toBe('files');
    expect(state.isSidebarOpen.value).toBe(true);
  });
});
