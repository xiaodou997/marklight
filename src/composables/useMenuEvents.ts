import { onMounted, onUnmounted } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

type SidebarMode = 'outline' | 'files';

export interface MenuHandlers {
  handleNew: () => void | Promise<void>;
  handleOpen: () => void | Promise<void>;
  handleOpenFolder: () => void | Promise<void>;
  handleSave: () => void | Promise<void> | Promise<boolean>;
  handleSaveAs: () => void | Promise<void>;
  exportHtml: () => void | Promise<void>;
  exportPdf: () => void | Promise<void>;
  copyToWechat: () => void | Promise<void>;
  editorAction: (action: string) => void;
  toggleSidebar: () => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSourceMode: () => void;
  openSettings: () => void;
  openSearch: (showReplace: boolean) => void | Promise<void>;
  handleOpenNewWindow: () => void | Promise<void>;
  toggleFocusMode: () => void | Promise<void>;
  openCommandPalette: () => void | Promise<void>;
  openShortcuts: () => void | Promise<void>;
  showAbout: () => void | Promise<void>;
  toggleFullscreen: () => void | Promise<void>;
  handleQuit: () => void | Promise<void>;
}

export function useMenuEvents(handlers: MenuHandlers) {
  let unlistenMenu: (() => void) | null = null;

  onMounted(async () => {
    unlistenMenu = await listen('menu-event', (event) => {
      const action = event.payload as string;
      switch (action) {
        case 'new': handlers.handleNew(); break;
        case 'open': handlers.handleOpen(); break;
        case 'open_folder': handlers.handleOpenFolder(); break;
        case 'save': handlers.handleSave(); break;
        case 'save_as': handlers.handleSaveAs(); break;
        case 'export_html': handlers.exportHtml(); break;
        case 'export_pdf': handlers.exportPdf(); break;
        case 'export_wechat': handlers.copyToWechat(); break;
        case 'undo':
        case 'redo':
        case 'cut':
        case 'copy':
        case 'paste':
        case 'select_all':
          handlers.editorAction(action);
          break;
        case 'toggle_sidebar': handlers.toggleSidebar(); break;
        case 'sidebar_outline':
          handlers.setSidebarMode('outline');
          handlers.setSidebarOpen(true);
          break;
        case 'sidebar_files':
          handlers.setSidebarMode('files');
          handlers.setSidebarOpen(true);
          break;
        case 'toggle_source': handlers.toggleSourceMode(); break;
        case 'settings': handlers.openSettings(); break;
        case 'find': handlers.openSearch(false); break;
        case 'replace': handlers.openSearch(true); break;
        case 'new_window': handlers.handleOpenNewWindow(); break;
        case 'focus_mode': handlers.toggleFocusMode(); break;
        case 'command_palette': handlers.openCommandPalette(); break;
        case 'github': openUrl('https://github.com/xiaodou997/marklight'); break;
        case 'gitee': openUrl('https://gitee.com/xiaodou997/marklight'); break;
        case 'issues': openUrl('https://github.com/xiaodou997/marklight/issues'); break;
        case 'check_updates': openUrl('https://github.com/xiaodou997/marklight/releases'); break;
        case 'shortcuts': handlers.openShortcuts(); break;
        case 'about': handlers.showAbout(); break;
        case 'fullscreen': handlers.toggleFullscreen(); break;
        case 'quit': handlers.handleQuit(); break;
      }
    });
  });

  onUnmounted(() => {
    if (unlistenMenu) unlistenMenu();
  });
}
