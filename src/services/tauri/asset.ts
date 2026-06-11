import { convertFileSrc } from '@tauri-apps/api/core';

export function toAssetUrl(path: string) {
  return convertFileSrc(path);
}
