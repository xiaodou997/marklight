import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

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
  await invoke('set_window_background_color', { color });
}

export async function openNewAppWindow(path?: string) {
  await invoke('open_new_window', { path });
}

export async function printCurrentDocument() {
  await invoke('print_document');
}

export async function refreshNativeMenuShortcuts(shortcuts: Record<string, string>) {
  await invoke('refresh_menu_shortcuts', { shortcuts });
}

export async function notifyFrontendReady() {
  await invoke('notify_frontend_ready');
}

export async function consumeStartupOpenFile() {
  return invoke<string | null>('consume_startup_open_file');
}

export async function consumePendingWindowOpenFile() {
  return invoke<string | null>('consume_pending_window_open_file');
}
