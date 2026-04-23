import { describe, expect, it } from 'vitest';
import {
  checkKeyConflicts,
  getMenuShortcuts,
  getShortcut,
  getShortcutGroups,
  getCommand,
} from '../registry';

describe('command registry', () => {
  it('resolves custom shortcuts over defaults', () => {
    const command = getCommand('file.save');
    expect(command).toBeDefined();
    expect(getShortcut(command!, { 'file.save': 'Mod-Alt-s' })).toBe('Mod-Alt-s');
  });

  it('groups shortcut commands by registry group', () => {
    const groups = getShortcutGroups();
    expect(groups.some((group) => group.group === 'format')).toBe(true);
    expect(groups.some((group) => group.group === 'file')).toBe(true);
  });

  it('detects shortcut conflicts across app and editor commands', () => {
    const conflicts = checkKeyConflicts({
      'file.save': 'Mod-s',
      'editor.bold': 'Mod-s',
    });
    expect(conflicts.map((command) => command.id)).toContain('editor.bold');
  });

  it('builds tauri menu accelerators from effective shortcuts', () => {
    const shortcuts = getMenuShortcuts({ 'view.showFiles': 'Mod-Shift-2' });
    expect(shortcuts['view.showFiles']).toBe('CmdOrCtrl+Shift+2');
    expect(shortcuts['file.save']).toBe('CmdOrCtrl+S');
  });
});
