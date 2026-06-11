import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { COMMANDS } from '../../commands/registry';
import { useCommandDispatcher } from '../useCommandDispatcher';

vi.mock('../../services/tauri/opener', () => ({
  openUrl: vi.fn(),
}));

vi.mock('../../services/tauri/window', () => ({
  revealStartupOpenLog: vi.fn(),
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

  const activeViewMode = ref<'editor' | 'image'>('editor');
  const isSourceMode = ref(false);
  const isSidebarOpen = ref(false);
  const sidebarMode = ref<'outline' | 'files'>('outline');

  const dispatcher = useCommandDispatcher({
    editorRef: ref({
      executeCommand: editorExecute,
      hasFocus,
      openSearch,
    }),
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

  it('handles every registered app command', async () => {
    const { dispatcher, spies, state } = createDispatcher();
    state.activeViewMode.value = 'editor';
    state.isSourceMode.value = false;

    const appCommands = COMMANDS.filter((command) => command.scope === 'app');

    for (const command of appCommands) {
      await expect(dispatcher.executeCommand(command.id, 'palette')).resolves.toBe(true);
    }

    expect(spies.handleNew).toHaveBeenCalled();
    expect(spies.handleOpen).toHaveBeenCalled();
    expect(spies.handleOpenFolder).toHaveBeenCalled();
    expect(spies.handleSave).toHaveBeenCalled();
    expect(spies.handleSaveAs).toHaveBeenCalled();
    expect(spies.handleOpenNewWindow).toHaveBeenCalled();
    expect(spies.exportHtml).toHaveBeenCalled();
    expect(spies.exportPdf).toHaveBeenCalled();
    expect(spies.copyToWechat).toHaveBeenCalled();
    expect(spies.openSearch).toHaveBeenCalledWith(false);
    expect(spies.openSearch).toHaveBeenCalledWith(true);
    expect(spies.openCommandPalette).toHaveBeenCalled();
    expect(spies.toggleSidebar).toHaveBeenCalled();
    expect(spies.toggleSourceMode).toHaveBeenCalled();
    expect(spies.toggleFocusMode).toHaveBeenCalled();
    expect(spies.toggleFullscreen).toHaveBeenCalled();
    expect(spies.openSettings).toHaveBeenCalled();
    expect(spies.openShortcuts).toHaveBeenCalled();
    expect(spies.showAbout).toHaveBeenCalled();
    expect(spies.handleQuit).toHaveBeenCalled();
  });
});
