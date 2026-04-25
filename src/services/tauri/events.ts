import { emit, listen } from '@tauri-apps/api/event';
import { APP_EVENT_NAMES } from './event-names';

export type AppEventHandler<T> = (payload: T) => void | Promise<void>;
export type FileChangeKind = 'create' | 'modify' | 'remove' | 'other';
export type AppOpenSource = 'startup' | 'cli' | 'os-open' | 'single-instance' | 'new-window';

export interface AppOpenPathsPayload {
  paths: string[];
  source: AppOpenSource;
}

export interface WorkspaceChangedPayload {
  rootPath: string;
  kind: FileChangeKind;
  paths: string[];
}

async function listenAppEvent<T>(eventName: string, handler: AppEventHandler<T>) {
  return listen(eventName, (event) => handler(event.payload as T));
}

export async function listenMenuEvent(handler: AppEventHandler<string>) {
  return listenAppEvent(APP_EVENT_NAMES.menu, handler);
}

export async function listenWindowCloseRequested(handler: AppEventHandler<null>) {
  return listenAppEvent(APP_EVENT_NAMES.windowCloseRequested, handler);
}

export async function listenAppOpenPaths(handler: AppEventHandler<AppOpenPathsPayload>) {
  return listenAppEvent(APP_EVENT_NAMES.appOpenPaths, handler);
}

export async function listenWorkspaceChanged(handler: AppEventHandler<WorkspaceChangedPayload>) {
  return listenAppEvent(APP_EVENT_NAMES.workspaceChanged, handler);
}

export async function emitMenuEvent(commandId: string) {
  await emit(APP_EVENT_NAMES.menu, commandId);
}

export async function emitWindowCloseRequested() {
  await emit(APP_EVENT_NAMES.windowCloseRequested);
}
