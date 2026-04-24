import { emit, listen } from '@tauri-apps/api/event';

export type AppEventHandler<T> = (payload: T) => void | Promise<void>;

async function listenAppEvent<T>(eventName: string, handler: AppEventHandler<T>) {
  return listen(eventName, (event) => handler(event.payload as T));
}

export async function listenMenuEvent(handler: AppEventHandler<string>) {
  return listenAppEvent('menu-event', handler);
}

export async function listenWindowCloseRequested(handler: AppEventHandler<null>) {
  return listenAppEvent('window-close-requested', handler);
}

export async function listenOpenFileInNewWindow(handler: AppEventHandler<string>) {
  return listenAppEvent('open-file-in-new-window', handler);
}

export async function listenOpenFileArgs(handler: AppEventHandler<string>) {
  return listenAppEvent('open-file-args', handler);
}

export async function listenTauriOpen(handler: AppEventHandler<unknown>) {
  return listenAppEvent('tauri://open', handler);
}

export async function listenStartupFile(handler: AppEventHandler<string>) {
  return listenAppEvent('open-startup-file', handler);
}

export async function listenFileChanged<T extends { kind: string; paths: string[] }>(
  handler: AppEventHandler<T>,
) {
  return listenAppEvent('file-changed', handler);
}

export async function emitMenuEvent(commandId: string) {
  await emit('menu-event', commandId);
}

export async function emitWindowCloseRequested() {
  await emit('window-close-requested');
}
