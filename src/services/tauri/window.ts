import { getCurrentWindow } from '@tauri-apps/api/window';
import { invokeCommand } from './client';
import { TAURI_COMMANDS } from './command-names';
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
  await invokeCommand<void>(TAURI_COMMANDS.setWindowBackgroundColor, { color });
}

export async function openEditorWindow(path?: string) {
  await invokeCommand<void>(TAURI_COMMANDS.openEditorWindow, { path });
}

export async function printDocument() {
  await invokeCommand<void>(TAURI_COMMANDS.printDocument);
}

export async function refreshNativeMenuShortcuts(shortcuts: Record<string, string>) {
  await invokeCommand<void>(TAURI_COMMANDS.refreshNativeMenuShortcuts, { shortcuts });
}

export async function revealStartupOpenLog() {
  return invokeCommand<string>(TAURI_COMMANDS.revealStartupOpenLog);
}

export async function consumeStartupOpenRequest() {
  return invokeCommand<AppOpenPathsPayload | null>(TAURI_COMMANDS.consumeStartupOpenRequest);
}

export async function notifyFrontendReady() {
  return invokeCommand<AppOpenPathsPayload | null>(TAURI_COMMANDS.notifyFrontendReady);
}

export async function consumeWindowOpenRequest() {
  return invokeCommand<AppOpenPathsPayload | null>(TAURI_COMMANDS.consumeWindowOpenRequest);
}
