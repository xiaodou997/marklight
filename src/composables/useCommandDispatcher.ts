import { openUrl } from '@tauri-apps/plugin-opener';
import type { Ref } from 'vue';
import type { CommandSource } from '../commands/registry';
import { getCommand } from '../commands/registry';

type SidebarMode = 'outline' | 'files';
type ViewMode = 'editor' | 'image';

export interface EditorCommandApi {
  executeCommand?: (commandId: string) => boolean;
  hasFocus?: () => boolean;
  openSearch?: (showReplace?: boolean) => void;
}

export interface CommandDispatcherOptions {
  editorRef: Ref<EditorCommandApi | null>;
  activeViewMode: Ref<ViewMode>;
  isSourceMode: Ref<boolean>;
  isSidebarOpen: Ref<boolean>;
  sidebarMode: Ref<SidebarMode>;
  handleNew: () => void | Promise<void>;
  handleOpen: () => void | Promise<void>;
  handleOpenFolder: () => void | Promise<void>;
  handleSave: () => void | Promise<void> | Promise<boolean> | boolean;
  handleSaveAs: () => void | Promise<void> | Promise<boolean> | boolean;
  handleOpenNewWindow: (path?: string) => void | Promise<void>;
  exportHtml: () => void | Promise<void>;
  exportPdf: () => void | Promise<void>;
  copyToWechat: () => void | Promise<void>;
  toggleSidebar: () => void;
  toggleSourceMode: () => void;
  openSettings: () => void;
  openCommandPalette: () => void;
  openShortcuts: () => void;
  toggleFocusMode: () => void | Promise<void>;
  showAbout: () => void | Promise<void>;
  toggleFullscreen: () => void | Promise<void>;
  handleQuit: () => void | Promise<void>;
}

export function useCommandDispatcher(options: CommandDispatcherOptions) {
  const {
    editorRef,
    activeViewMode,
    isSourceMode,
    isSidebarOpen,
    sidebarMode,
  } = options;

  function canRunEditorShortcut() {
    if (activeViewMode.value !== 'editor' || isSourceMode.value) {
      return false;
    }
    return editorRef.value?.hasFocus?.() ?? false;
  }

  async function executeCommand(commandId: string, source: CommandSource = 'menu'): Promise<boolean> {
    const command = getCommand(commandId);
    if (!command) {
      return false;
    }

    if (command.scope === 'editor') {
      if (source === 'shortcut' && !canRunEditorShortcut()) {
        return false;
      }
      return editorRef.value?.executeCommand?.(commandId) ?? false;
    }

    switch (commandId) {
      case 'file.new':
        await options.handleNew();
        return true;
      case 'file.open':
        await options.handleOpen();
        return true;
      case 'file.openFolder':
        await options.handleOpenFolder();
        return true;
      case 'file.save':
        await options.handleSave();
        return true;
      case 'file.saveAs':
        await options.handleSaveAs();
        return true;
      case 'file.newWindow':
        await options.handleOpenNewWindow();
        return true;
      case 'export.html':
        await options.exportHtml();
        return true;
      case 'export.pdf':
        await options.exportPdf();
        return true;
      case 'export.wechat':
        await options.copyToWechat();
        return true;
      case 'edit.find':
        if (activeViewMode.value === 'editor' && !isSourceMode.value) {
          editorRef.value?.openSearch?.(false);
          return true;
        }
        return false;
      case 'edit.replace':
        if (activeViewMode.value === 'editor' && !isSourceMode.value) {
          editorRef.value?.openSearch?.(true);
          return true;
        }
        return false;
      case 'edit.commandPalette':
        options.openCommandPalette();
        return true;
      case 'view.toggleSidebar':
        options.toggleSidebar();
        return true;
      case 'view.showOutline':
        sidebarMode.value = 'outline';
        isSidebarOpen.value = true;
        return true;
      case 'view.showFiles':
        sidebarMode.value = 'files';
        isSidebarOpen.value = true;
        return true;
      case 'view.toggleSourceMode':
        options.toggleSourceMode();
        return true;
      case 'view.focusMode':
        await options.toggleFocusMode();
        return true;
      case 'view.fullscreen':
        await options.toggleFullscreen();
        return true;
      case 'settings.open':
        options.openSettings();
        return true;
      case 'help.shortcuts':
        options.openShortcuts();
        return true;
      case 'help.about':
        await options.showAbout();
        return true;
      case 'help.github':
        await openUrl('https://github.com/xiaodou997/marklight');
        return true;
      case 'help.gitee':
        await openUrl('https://gitee.com/xiaodou997/marklight');
        return true;
      case 'help.issues':
        await openUrl('https://github.com/xiaodou997/marklight/issues');
        return true;
      case 'app.quit':
        await options.handleQuit();
        return true;
      default:
        return false;
    }
  }

  return {
    executeCommand,
  };
}
