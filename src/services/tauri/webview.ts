import type { Event as TauriEvent, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview, type DragDropEvent } from '@tauri-apps/api/webview';

export type WebviewDragDropEvent = TauriEvent<DragDropEvent>;
export type WebviewDragDropHandler = (event: WebviewDragDropEvent) => void | Promise<void>;
export type { DragDropEvent, UnlistenFn };

export async function listenCurrentWebviewDragDrop(handler: WebviewDragDropHandler) {
  return getCurrentWebview().onDragDropEvent(handler);
}
