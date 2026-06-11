import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  WINDOW_TITLEBAR_MENUS,
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

  it('keeps command ids unique and lookupable', () => {
    const ids = COMMANDS.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(getCommand(id)?.id).toBe(id);
    }
  });

  it('keeps titlebar menu entries backed by registered commands', () => {
    const ids = new Set(COMMANDS.map((command) => command.id));

    for (const menu of WINDOW_TITLEBAR_MENUS) {
      for (const item of menu.items) {
        if (item === 'separator') {
          continue;
        }

        expect(ids.has(item)).toBe(true);
      }
    }
  });

  it('keeps menu shortcuts limited to registered menu commands', () => {
    const menuCommandIds = new Set(
      COMMANDS.filter((command) => command.menuSection).map((command) => command.id),
    );
    const shortcutIds = Object.keys(getMenuShortcuts());

    expect(shortcutIds.length).toBeGreaterThan(0);
    for (const id of shortcutIds) {
      expect(menuCommandIds.has(id)).toBe(true);
    }
  });
});
