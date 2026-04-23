import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
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
  let unlistenStartupFile: (() => void) | null = null;

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

    // macOS 热启动：App 已运行时通过"打开方式"打开文件（RunEvent::Opened 直接广播）
    unlistenTauriOpen = await listen<unknown>('tauri://open', (event) => {
      const payload = event.payload as unknown;
      if (typeof payload === 'string') {
        options.handleOpenFile(payload);
        return;
      }
      if (Array.isArray(payload)) {
        const filePath = payload.find((item): item is string => typeof item === 'string');
        if (filePath) options.handleOpenFile(filePath);
        return;
      }
      if (payload && typeof payload === 'object' && 'paths' in payload) {
        const paths = (payload as { paths?: unknown }).paths;
        if (Array.isArray(paths)) {
          const filePath = paths.find((item): item is string => typeof item === 'string');
          if (filePath) options.handleOpenFile(filePath);
        }
      }
    });

    // macOS 冷启动（推送模型）：
    // 先注册监听器，再通知 Rust 前端已就绪。
    // Rust 收到通知后检查 StartupOpenFile，若有等待中的文件则主动推送过来。
    // 这样完全消除"RunEvent::Opened 比 invoke 晚触发"的竞态条件。
    unlistenStartupFile = await listen<string>('open-startup-file', (event) => {
      if (event.payload) options.handleOpenFile(event.payload);
    });

    try {
      await invoke('notify_frontend_ready');
    } catch {
      // 降级兜底：直接拉取（兼容旧版本或命令不存在的情况）
      try {
        const startupFile = await invoke<string | null>('consume_startup_open_file');
        if (startupFile) options.handleOpenFile(startupFile);
      } catch { /* ignore */ }
    }

    try {
      const pendingFile = await invoke<string | null>('consume_pending_window_open_file');
      if (pendingFile) {
        options.handleOpenFile(pendingFile);
      }
    } catch {
      // ignore pending file fetch failures for older runtimes
    }
  }

  function cleanup() {
    unlistenOpenFile?.();
    unlistenCloseRequest?.();
    unlistenFileArgs?.();
    unlistenTauriOpen?.();
    unlistenStartupFile?.();
  }

  return { setup, cleanup, appWindow };
}
