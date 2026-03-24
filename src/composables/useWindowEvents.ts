import { listen } from '@tauri-apps/api/event';
import { confirm } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface WindowEventsOptions {
  handleOpenFile: (path: string) => void;
  handleSave: () => Promise<boolean>;
  isDirty: () => boolean;
}

/**
 * 未保存更改确认：返回 'save' | 'discard' | 'cancel'
 */
export async function confirmUnsavedChanges(): Promise<'save' | 'discard' | 'cancel'> {
  const shouldSave = await confirm('文件未保存，是否保存后再继续？\n\n选择"保存"保存文件，选择"不保存"放弃更改。', {
    title: '未保存的更改',
    kind: 'warning',
    okLabel: '保存',
    cancelLabel: '不保存'
  });
  if (shouldSave) return 'save';
  const discard = await confirm('确定不保存直接关闭吗？未保存的更改将丢失。', {
    title: '确认放弃更改',
    kind: 'warning',
    okLabel: '不保存并关闭',
    cancelLabel: '取消'
  });
  return discard ? 'discard' : 'cancel';
}

export function useWindowEvents(options: WindowEventsOptions) {
  const appWindow = getCurrentWindow();

  let unlistenOpenFile: (() => void) | null = null;
  let unlistenCloseRequest: (() => void) | null = null;
  let unlistenFileArgs: (() => void) | null = null;
  let unlistenTauriOpen: (() => void) | null = null;

  async function setup() {
    unlistenOpenFile = await listen<string>('open-file-in-new-window', (event) => {
      options.handleOpenFile(event.payload);
    });

    unlistenCloseRequest = await listen('window-close-requested', async () => {
      if (options.isDirty()) {
        const result = await confirmUnsavedChanges();
        if (result === 'cancel') return;
        if (result === 'save') {
          const saved = await options.handleSave();
          if (!saved) return;
        }
      }
      await appWindow.destroy();
    });

    // Windows/Linux: 命令行参数打开文件
    unlistenFileArgs = await listen<string>('open-file-args', (event) => {
      options.handleOpenFile(event.payload);
    });

    // macOS: 文件关联打开（兼容 string / string[] / { paths: string[] }）
    unlistenTauriOpen = await listen<unknown>('tauri://open', (event) => {
      const payload = event.payload as unknown;
      if (typeof payload === 'string') {
        options.handleOpenFile(payload);
        return;
      }
      if (Array.isArray(payload)) {
        const filePath = payload.find((item): item is string => typeof item === 'string');
        if (filePath) {
          options.handleOpenFile(filePath);
        }
        return;
      }
      if (payload && typeof payload === 'object' && 'paths' in payload) {
        const paths = (payload as { paths?: unknown }).paths;
        if (Array.isArray(paths)) {
          const filePath = paths.find((item): item is string => typeof item === 'string');
          if (filePath) {
            options.handleOpenFile(filePath);
          }
        }
      }
    });
  }

  function cleanup() {
    unlistenOpenFile?.();
    unlistenCloseRequest?.();
    unlistenFileArgs?.();
    unlistenTauriOpen?.();
  }

  return { setup, cleanup, appWindow };
}
