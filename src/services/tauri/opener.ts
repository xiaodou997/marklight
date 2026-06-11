import { openUrl as tauriOpenUrl } from '@tauri-apps/plugin-opener';

export async function openUrl(url: string) {
  return tauriOpenUrl(url);
}
