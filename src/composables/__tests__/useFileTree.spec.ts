import { describe, expect, it } from 'vitest';
import { isPathInTreeRoot, normalizeWatchPath } from '../useFileTree';

describe('useFileTree path helpers', () => {
  it('normalizes windows separators and trailing slashes', () => {
    expect(normalizeWatchPath('C:\\docs\\notes\\')).toBe('C:/docs/notes');
  });

  it('matches files inside a unix root path', () => {
    expect(isPathInTreeRoot('/tmp/project/file.md', '/tmp/project')).toBe(true);
  });

  it('matches files inside a windows root path', () => {
    expect(isPathInTreeRoot('C:\\docs\\notes\\file.md', 'C:\\docs\\notes')).toBe(true);
  });

  it('does not match sibling paths with the same prefix', () => {
    expect(isPathInTreeRoot('/tmp/project-two/file.md', '/tmp/project')).toBe(false);
  });
});
