import { getCurrentWindow } from '@tauri-apps/api/window';
import { invokeCommand } from './client';
import type { AppOpenPathsPayload } from './events';

export type NativeWindowTheme = 'light' | 'dark';

function currentWindow() {
  return getCurrentWindow();
}

export async function setCurrentWindowTitle(title: string) {
  await currentWindow().setTitle(title);
}

export async function destroyCurrentWindow() {
  await currentWindow().destroy();
}

export async function minimizeCurrentWindow() {
  await currentWindow().minimize();
}

export async function toggleCurrentWindowMaximize() {
  await currentWindow().toggleMaximize();
}

export async function isCurrentWindowFullscreen() {
  return currentWindow().isFullscreen();
}

export async function setCurrentWindowFullscreen(fullscreen: boolean) {
  await currentWindow().setFullscreen(fullscreen);
}

export async function setCurrentWindowTheme(theme: NativeWindowTheme) {
  await currentWindow().setTheme(theme);
}

export async function setCurrentWindowBackgroundColor(color: string) {
  await invokeCommand<void>('set_window_background_color', { color });
}

export async function openEditorWindow(path?: string) {
  await invokeCommand<void>('open_editor_window', { path });
}

export async function printDocument() {
  await invokeCommand<void>('print_document');
}

export async function refreshNativeMenuShortcuts(shortcuts: Record<string, string>) {
  await invokeCommand<void>('refresh_native_menu_shortcuts', { shortcuts });
}

export async function revealStartupOpenLog() {
  return invokeCommand<string>('reveal_startup_open_log');
}

export async function consumeStartupOpenRequest() {
  return invokeCommand<AppOpenPathsPayload | null>('consume_startup_open_request');
}

export async function notifyFrontendReady() {
  return invokeCommand<AppOpenPathsPayload | null>('notify_frontend_ready');
}

export async function consumeWindowOpenRequest() {
  return invokeCommand<AppOpenPathsPayload | null>('consume_window_open_request');
}
