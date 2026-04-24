import { invoke } from '@tauri-apps/api/core';

export interface TauriAppError {
  code: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function parseJsonError(error: string): TauriAppError | null {
  try {
    const parsed = JSON.parse(error);
    if (isRecord(parsed) && typeof parsed.code === 'string' && typeof parsed.message === 'string') {
      return {
        code: parsed.code,
        message: parsed.message,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeTauriError(error: unknown): TauriAppError {
  if (typeof error === 'string') {
    return parseJsonError(error) ?? { code: 'unknown_error', message: error };
  }

  if (isRecord(error)) {
    if (typeof error.code === 'string' && typeof error.message === 'string') {
      return {
        code: error.code,
        message: error.message,
      };
    }

    if (typeof error.message === 'string') {
      return { code: 'unknown_error', message: error.message };
    }
  }

  if (error instanceof Error) {
    return { code: 'unknown_error', message: error.message };
  }

  return {
    code: 'unknown_error',
    message: '发生未知错误',
  };
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeTauriError(error);
  }
}

export function isTauriErrorCode(error: unknown, code: string): error is TauriAppError {
  const normalized = normalizeTauriError(error);
  return normalized.code === code;
}
