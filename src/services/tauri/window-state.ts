import { saveWindowState, StateFlags } from '@tauri-apps/plugin-window-state';

export const DEFAULT_WINDOW_STATE_FLAGS =
  StateFlags.SIZE | StateFlags.POSITION | StateFlags.MAXIMIZED | StateFlags.FULLSCREEN;

export async function saveAllWindowState() {
  await saveWindowState(DEFAULT_WINDOW_STATE_FLAGS);
}
