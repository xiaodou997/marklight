import { describe, expect, it } from 'vitest';
import { getCodeBlockLanguageLabel, normalizeCodeBlockLanguage } from '../code-block';

describe('normalizeCodeBlockLanguage', () => {
  it('normalizes language ids for storage', () => {
    expect(normalizeCodeBlockLanguage(' TypeScript ')).toBe('typescript');
  });

  it('returns null for empty values', () => {
    expect(normalizeCodeBlockLanguage('')).toBe(null);
    expect(normalizeCodeBlockLanguage('   ')).toBe(null);
    expect(normalizeCodeBlockLanguage(null)).toBe(null);
    expect(normalizeCodeBlockLanguage(undefined)).toBe(null);
  });
});

describe('getCodeBlockLanguageLabel', () => {
  it('returns the language when present', () => {
    expect(getCodeBlockLanguageLabel('java')).toBe('java');
  });

  it('falls back to plain text for empty values', () => {
    expect(getCodeBlockLanguageLabel('')).toBe('plain text');
    expect(getCodeBlockLanguageLabel('   ')).toBe('plain text');
    expect(getCodeBlockLanguageLabel(null)).toBe('plain text');
    expect(getCodeBlockLanguageLabel(undefined)).toBe('plain text');
  });
});
