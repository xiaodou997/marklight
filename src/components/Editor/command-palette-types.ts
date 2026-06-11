import type { CommandDefinition } from '../../commands/registry';

export interface CommandPaletteCommand extends CommandDefinition {
  shortcut?: string;
}

export interface CommandPaletteFile {
  name: string;
  path: string;
  is_dir: boolean;
  is_md: boolean;
}
