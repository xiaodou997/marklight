import { describe, expect, it } from 'vitest';
import { normalizeTauriError } from '../client';

describe('tauri client helpers', () => {
  it('normalizes structured tauri errors', () => {
    expect(
      normalizeTauriError({
        code: 'document_conflict',
        message: 'conflict',
      }),
    ).toEqual({
      code: 'document_conflict',
      message: 'conflict',
    });
  });

  it('parses serialized structured errors', () => {
    expect(
      normalizeTauriError('{"code":"document_conflict","message":"conflict"}'),
    ).toEqual({
      code: 'document_conflict',
      message: 'conflict',
    });
  });
});
