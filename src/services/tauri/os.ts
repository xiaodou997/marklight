import { platform as tauriPlatform } from '@tauri-apps/plugin-os';

export function platform() {
  return tauriPlatform();
}
