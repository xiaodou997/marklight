import { emit, listen } from '@tauri-apps/api/event';
import { APP_EVENT_NAMES } from './event-names';

export type AppEventHandler<T> = (payload: T) => void | Promise<void>;
export type FileChangeKind = 'create' | 'modify' | 'remove' | 'other';
export type OpenFilePayload = string[];

export interface FileChangePayload {
  kind: FileChangeKind;
  paths: string[];
}

async function listenAppEvent<T>(eventName: string, handler: AppEventHandler<T>) {
  return listen(eventName, (event) => handler(event.payload as T));
}

function normalizeOpenFilePayload(payload: unknown): OpenFilePayload {
  if (typeof payload === 'string') {
    return [payload];
  }

  if (Array.isArray(payload)) {
    return payload.filter((item): item is string => typeof item === 'string');
  }

  if (payload && typeof payload === 'object' && 'paths' in payload) {
    const paths = (payload as { paths?: unknown }).paths;
    if (Array.isArray(paths)) {
      return paths.filter((item): item is string => typeof item === 'string');
    }
  }

  return [];
}

export async function listenMenuEvent(handler: AppEventHandler<string>) {
  return listenAppEvent(APP_EVENT_NAMES.menu, handler);
}

export async function listenWindowCloseRequested(handler: AppEventHandler<null>) {
  return listenAppEvent(APP_EVENT_NAMES.windowCloseRequested, handler);
}

export async function listenOpenFileInNewWindow(handler: AppEventHandler<string>) {
  return listenAppEvent(APP_EVENT_NAMES.openFileInNewWindow, handler);
}

export async function listenOpenFileArgs(handler: AppEventHandler<string>) {
  return listenAppEvent(APP_EVENT_NAMES.openFileArgs, handler);
}

export async function listenTauriOpen(handler: AppEventHandler<OpenFilePayload>) {
  return listen(APP_EVENT_NAMES.tauriOpen, (event) =>
    handler(normalizeOpenFilePayload(event.payload)),
  );
}

export async function listenStartupFile(handler: AppEventHandler<string>) {
  return listenAppEvent(APP_EVENT_NAMES.startupFile, handler);
}

export async function listenFileChanged(handler: AppEventHandler<FileChangePayload>) {
  return listenAppEvent(APP_EVENT_NAMES.fileChanged, handler);
}

export async function emitMenuEvent(commandId: string) {
  await emit(APP_EVENT_NAMES.menu, commandId);
}

export async function emitWindowCloseRequested() {
  await emit(APP_EVENT_NAMES.windowCloseRequested);
}
