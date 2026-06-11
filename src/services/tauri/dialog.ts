import {
  confirm as tauriConfirm,
  message as tauriMessage,
  open as tauriOpen,
  save as tauriSave,
  type ConfirmDialogOptions,
  type MessageDialogOptions,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from '@tauri-apps/plugin-dialog';

export async function confirm(message: string, options?: string | ConfirmDialogOptions) {
  return tauriConfirm(message, options);
}

export async function message(message: string, options?: string | MessageDialogOptions) {
  return tauriMessage(message, options);
}

export async function open<T extends OpenDialogOptions>(options?: T) {
  return tauriOpen(options);
}

export async function save(options?: SaveDialogOptions) {
  return tauriSave(options);
}
