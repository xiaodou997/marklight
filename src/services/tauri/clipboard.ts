import { writeHtml as tauriWriteHtml } from '@tauri-apps/plugin-clipboard-manager';

export async function writeHtml(html: string, altText?: string) {
  return tauriWriteHtml(html, altText);
}
