import { confirm } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { Ref } from 'vue';
import { onUnmounted, watch } from 'vue';
import type { AppOpenPathsPayload } from '../services/tauri/events';
import { listenAppOpenPaths, listenWindowCloseRequested } from '../services/tauri/events';
import {
  consumeStartupOpenRequest,
  consumeWindowOpenRequest,
  destroyCurrentWindow,
  isCurrentWindowFullscreen,
  notifyFrontendReady,
  openEditorWindow,
  setCurrentWindowFullscreen,
  setCurrentWindowTitle,
} from '../services/tauri/window';
import { saveAllWindowState } from '../services/tauri/window-state';

interface AppWindowSessionOptions {
  openDocument: (path: string) => void | Promise<void>;
  saveDocument: () => Promise<boolean>;
  isDirty: () => boolean;
  windowTitle: Ref<string>;
}

export async function confirmUnsavedChanges(): Promise<'save' | 'discard' | 'cancel'> {
  const shouldSave = await confirm(
    '文件未保存，是否保存后再继续？\n\n选择"保存"保存文件，选择"不保存"放弃更改。',
    {
      title: '未保存的更改',
      kind: 'warning',
      okLabel: '保存',
      cancelLabel: '不保存',
    },
  );
  if (shouldSave) {
    return 'save';
  }

  const discard = await confirm('确定不保存直接关闭吗？未保存的更改将丢失。', {
    title: '确认放弃更改',
    kind: 'warning',
    okLabel: '不保存并关闭',
    cancelLabel: '取消',
  });
  return discard ? 'discard' : 'cancel';
}

export function useAppWindowSession(options: AppWindowSessionOptions) {
  let unlistenAppOpenPaths: (() => void) | null = null;
  let unlistenCloseRequest: (() => void) | null = null;
  let unlistenDragDrop: (() => void) | null = null;
  let removeDragOverListener: (() => void) | null = null;
  let removeDropListener: (() => void) | null = null;
  let stopTitleWatcher: (() => void) | null = null;

  async function handleOpenPayload(payload: AppOpenPathsPayload | null | undefined) {
    const firstPath = payload?.paths[0];
    if (!firstPath) {
      return;
    }
    await options.openDocument(firstPath);
  }

  async function handleCloseRequest() {
    if (options.isDirty()) {
      const result = await confirmUnsavedChanges();
      if (result === 'cancel') {
        return;
      }
      if (result === 'save') {
        const saved = await options.saveDocument();
        if (!saved) {
          return;
        }
      }
    }

    await saveAllWindowState().catch(() => undefined);
    await destroyCurrentWindow();
  }

  async function setupDragDrop() {
    const preventNavigation = (event: DragEvent) => {
      event.preventDefault();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('dragover', preventNavigation);
      document.addEventListener('drop', preventNavigation);
      removeDragOverListener = () => {
        document.removeEventListener('dragover', preventNavigation);
      };
      removeDropListener = () => {
        document.removeEventListener('drop', preventNavigation);
      };
    }

    const webview = getCurrentWebview();
    unlistenDragDrop = await webview.onDragDropEvent(async (event) => {
      if (event.payload.type !== 'drop') {
        return;
      }
      const documentPath = event.payload.paths.find((path) => /\.(md|markdown|txt)$/i.test(path));
      if (documentPath) {
        await options.openDocument(documentPath);
      }
    });
  }

  async function setup() {
    stopTitleWatcher = watch(
      options.windowTitle,
      (title) => {
        setCurrentWindowTitle(title).catch((error: string) => {
          if (!String(error).includes('window.set_title not allowed')) {
            console.error('Failed to set window title:', error);
          }
        });
      },
      { immediate: true },
    );

    unlistenAppOpenPaths = await listenAppOpenPaths(handleOpenPayload);
    unlistenCloseRequest = await listenWindowCloseRequested(async () => {
      await handleCloseRequest();
    });

    await handleOpenPayload(await consumeStartupOpenRequest());
    await handleOpenPayload(await consumeWindowOpenRequest());
    await setupDragDrop();
    await handleOpenPayload(await notifyFrontendReady());
  }

  function cleanup() {
    unlistenAppOpenPaths?.();
    unlistenAppOpenPaths = null;
    unlistenCloseRequest?.();
    unlistenCloseRequest = null;
    unlistenDragDrop?.();
    unlistenDragDrop = null;
    removeDragOverListener?.();
    removeDragOverListener = null;
    removeDropListener?.();
    removeDropListener = null;
    stopTitleWatcher?.();
    stopTitleWatcher = null;
  }

  async function handleOpenEditorWindow(path?: string) {
    await openEditorWindow(path);
  }

  async function toggleFullscreen() {
    await setCurrentWindowFullscreen(!(await isCurrentWindowFullscreen()));
  }

  async function handleQuit() {
    await handleCloseRequest();
  }

  onUnmounted(cleanup);

  return {
    setup,
    cleanup,
    handleOpenEditorWindow,
    toggleFullscreen,
    handleQuit,
  };
}
