import { isMac } from '../utils/platform';

export type CommandScope = 'app' | 'editor';
export type CommandSource = 'shortcut' | 'menu' | 'palette' | 'titlebar' | 'ui';
export type CommandGroup =
  | 'file'
  | 'edit'
  | 'format'
  | 'heading'
  | 'list'
  | 'block'
  | 'history'
  | 'view'
  | 'export'
  | 'help';
export type MenuSection = 'app' | 'file' | 'edit' | 'view' | 'help';

export interface CommandDefinition {
  id: string;
  title: string;
  description: string;
  icon?: string;
  scope: CommandScope;
  group: CommandGroup;
  defaultShortcut?: string;
  menuSection?: MenuSection;
  palette?: boolean;
}

export interface ShortcutCommand extends CommandDefinition {
  shortcut: string;
}

const GROUP_LABELS: Record<CommandGroup, string> = {
  file: '文件',
  edit: '编辑',
  format: '格式化',
  heading: '标题',
  list: '列表',
  block: '块级元素',
  history: '历史',
  view: '视图',
  export: '导出',
  help: '帮助',
};

export const COMMANDS: CommandDefinition[] = [
  {
    id: 'file.new',
    title: '新建文件',
    description: '创建一个新的 Markdown 文档',
    icon: '📄',
    scope: 'app',
    group: 'file',
    defaultShortcut: 'Mod-n',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'file.open',
    title: '打开文件',
    description: '打开现有 Markdown 文件',
    icon: '📂',
    scope: 'app',
    group: 'file',
    defaultShortcut: 'Mod-o',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'file.openFolder',
    title: '打开文件夹',
    description: '打开侧边栏文件树根目录',
    icon: '📁',
    scope: 'app',
    group: 'file',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'file.save',
    title: '保存文件',
    description: '保存当前文档',
    icon: '💾',
    scope: 'app',
    group: 'file',
    defaultShortcut: 'Mod-s',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'file.saveAs',
    title: '另存为...',
    description: '将当前文档另存为新文件',
    icon: '💾',
    scope: 'app',
    group: 'file',
    defaultShortcut: 'Mod-Shift-s',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'file.newWindow',
    title: '新建窗口',
    description: '打开一个新的编辑窗口',
    icon: '🪟',
    scope: 'app',
    group: 'file',
    defaultShortcut: 'Mod-Alt-n',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'export.html',
    title: '导出为 HTML',
    description: '导出当前文档为 HTML 文件',
    icon: '🌐',
    scope: 'app',
    group: 'export',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'export.pdf',
    title: '导出为 PDF',
    description: '通过系统打印导出 PDF',
    icon: '📕',
    scope: 'app',
    group: 'export',
    defaultShortcut: 'Mod-Shift-p',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'export.wechat',
    title: '微信导出',
    description: '复制为适合微信的 HTML 内容',
    icon: '💬',
    scope: 'app',
    group: 'export',
    defaultShortcut: 'Mod-e',
    menuSection: 'file',
    palette: true,
  },
  {
    id: 'help.diagnostics',
    title: '打开启动诊断日志',
    description: '在 Finder 中定位冷启动文件打开诊断日志',
    icon: '🧪',
    scope: 'app',
    group: 'help',
    menuSection: 'help',
    palette: true,
  },
  {
    id: 'editor.undo',
    title: '撤销',
    description: '撤销最近一次编辑',
    icon: '↶',
    scope: 'editor',
    group: 'history',
    defaultShortcut: 'Mod-z',
    menuSection: 'edit',
    palette: true,
  },
  {
    id: 'editor.redo',
    title: '重做',
    description: '重做刚刚撤销的编辑',
    icon: '↷',
    scope: 'editor',
    group: 'history',
    defaultShortcut: 'Mod-Shift-z',
    menuSection: 'edit',
    palette: true,
  },
  {
    id: 'editor.bold',
    title: '粗体',
    description: '切换粗体格式',
    icon: '𝐁',
    scope: 'editor',
    group: 'format',
    defaultShortcut: 'Mod-b',
    palette: true,
  },
  {
    id: 'editor.italic',
    title: '斜体',
    description: '切换斜体格式',
    icon: '𝐼',
    scope: 'editor',
    group: 'format',
    defaultShortcut: 'Mod-i',
    palette: true,
  },
  {
    id: 'editor.strike',
    title: '删除线',
    description: '切换删除线格式',
    icon: 'S',
    scope: 'editor',
    group: 'format',
    defaultShortcut: 'Mod-Shift-x',
    palette: true,
  },
  {
    id: 'editor.highlight',
    title: '高亮',
    description: '切换高亮格式',
    icon: '🖍️',
    scope: 'editor',
    group: 'format',
    defaultShortcut: 'Mod-Shift-h',
    palette: true,
  },
  {
    id: 'editor.code',
    title: '行内代码',
    description: '切换行内代码格式',
    icon: '</>',
    scope: 'editor',
    group: 'format',
    defaultShortcut: 'Mod-`',
    palette: true,
  },
  {
    id: 'editor.heading1',
    title: '一级标题',
    description: '切换为一级标题',
    scope: 'editor',
    group: 'heading',
    defaultShortcut: 'Mod-1',
    palette: true,
  },
  {
    id: 'editor.heading2',
    title: '二级标题',
    description: '切换为二级标题',
    scope: 'editor',
    group: 'heading',
    defaultShortcut: 'Mod-2',
    palette: true,
  },
  {
    id: 'editor.heading3',
    title: '三级标题',
    description: '切换为三级标题',
    scope: 'editor',
    group: 'heading',
    defaultShortcut: 'Mod-3',
    palette: true,
  },
  {
    id: 'editor.heading4',
    title: '四级标题',
    description: '切换为四级标题',
    scope: 'editor',
    group: 'heading',
    defaultShortcut: 'Mod-4',
    palette: true,
  },
  {
    id: 'editor.heading5',
    title: '五级标题',
    description: '切换为五级标题',
    scope: 'editor',
    group: 'heading',
    defaultShortcut: 'Mod-5',
    palette: true,
  },
  {
    id: 'editor.heading6',
    title: '六级标题',
    description: '切换为六级标题',
    scope: 'editor',
    group: 'heading',
    defaultShortcut: 'Mod-6',
    palette: true,
  },
  {
    id: 'editor.paragraph',
    title: '普通段落',
    description: '切换为普通段落',
    scope: 'editor',
    group: 'heading',
    defaultShortcut: 'Mod-0',
    palette: true,
  },
  {
    id: 'editor.bulletList',
    title: '无序列表',
    description: '切换无序列表',
    scope: 'editor',
    group: 'list',
    defaultShortcut: 'Mod-Shift-8',
    palette: true,
  },
  {
    id: 'editor.orderedList',
    title: '有序列表',
    description: '切换有序列表',
    scope: 'editor',
    group: 'list',
    defaultShortcut: 'Mod-Shift-7',
    palette: true,
  },
  {
    id: 'editor.taskList',
    title: '任务列表',
    description: '切换任务列表',
    scope: 'editor',
    group: 'list',
    defaultShortcut: 'Mod-Shift-9',
    palette: true,
  },
  {
    id: 'editor.blockquote',
    title: '引用块',
    description: '切换引用块',
    scope: 'editor',
    group: 'block',
    defaultShortcut: 'Mod-Shift-q',
    palette: true,
  },
  {
    id: 'editor.codeBlock',
    title: '代码块',
    description: '切换代码块',
    scope: 'editor',
    group: 'block',
    defaultShortcut: 'Mod-Shift-c',
    palette: true,
  },
  {
    id: 'edit.find',
    title: '查找',
    description: '打开编辑器内查找',
    icon: '🔍',
    scope: 'app',
    group: 'edit',
    defaultShortcut: 'Mod-f',
    menuSection: 'edit',
    palette: true,
  },
  {
    id: 'edit.replace',
    title: '查找和替换',
    description: '打开编辑器内查找替换',
    icon: '🔄',
    scope: 'app',
    group: 'edit',
    defaultShortcut: 'Mod-h',
    menuSection: 'edit',
    palette: true,
  },
  {
    id: 'edit.commandPalette',
    title: '命令面板',
    description: '打开命令面板',
    icon: '⌨️',
    scope: 'app',
    group: 'edit',
    defaultShortcut: 'Mod-k',
    menuSection: 'edit',
    palette: true,
  },
  {
    id: 'view.toggleSidebar',
    title: '切换侧边栏',
    description: '显示或隐藏侧边栏',
    icon: '📋',
    scope: 'app',
    group: 'view',
    defaultShortcut: 'Mod-\\',
    menuSection: 'view',
    palette: true,
  },
  {
    id: 'view.showOutline',
    title: '显示大纲',
    description: '切换到侧边栏大纲',
    icon: '📑',
    scope: 'app',
    group: 'view',
    defaultShortcut: 'Mod-Alt-1',
    menuSection: 'view',
    palette: true,
  },
  {
    id: 'view.showFiles',
    title: '显示文件树',
    description: '切换到侧边栏文件树',
    icon: '🗂️',
    scope: 'app',
    group: 'view',
    defaultShortcut: 'Mod-Alt-2',
    menuSection: 'view',
    palette: true,
  },
  {
    id: 'view.toggleSourceMode',
    title: '源码模式',
    description: '切换源码模式',
    icon: '📝',
    scope: 'app',
    group: 'view',
    defaultShortcut: 'Mod-/',
    menuSection: 'view',
    palette: true,
  },
  {
    id: 'view.focusMode',
    title: '焦点模式',
    description: '切换焦点模式',
    icon: '🎯',
    scope: 'app',
    group: 'view',
    defaultShortcut: 'Mod-Shift-f',
    menuSection: 'view',
    palette: true,
  },
  {
    id: 'view.fullscreen',
    title: '全屏',
    description: '切换应用全屏显示',
    icon: '⛶',
    scope: 'app',
    group: 'view',
    defaultShortcut: isMac ? 'Mod-Ctrl-f' : 'F11',
    menuSection: 'view',
    palette: true,
  },
  {
    id: 'settings.open',
    title: '打开设置',
    description: '打开应用设置',
    icon: '⚙️',
    scope: 'app',
    group: 'help',
    defaultShortcut: 'Mod-,',
    menuSection: 'app',
    palette: true,
  },
  {
    id: 'help.shortcuts',
    title: '快捷键帮助',
    description: '打开快捷键帮助窗口',
    icon: '⌘',
    scope: 'app',
    group: 'help',
    defaultShortcut: 'Mod-Shift-k',
    menuSection: 'help',
    palette: true,
  },
  {
    id: 'help.about',
    title: '关于 MarkLight',
    description: '显示应用版本与项目信息',
    icon: 'ℹ️',
    scope: 'app',
    group: 'help',
    menuSection: 'app',
    palette: true,
  },
  {
    id: 'help.github',
    title: '项目主页 (GitHub)',
    description: '打开 GitHub 项目主页',
    scope: 'app',
    group: 'help',
    menuSection: 'help',
  },
  {
    id: 'help.gitee',
    title: '项目主页 (Gitee)',
    description: '打开 Gitee 项目主页',
    scope: 'app',
    group: 'help',
    menuSection: 'help',
  },
  {
    id: 'help.issues',
    title: '报告问题',
    description: '打开问题反馈页',
    scope: 'app',
    group: 'help',
    menuSection: 'help',
  },
  {
    id: 'app.quit',
    title: '退出 MarkLight',
    description: '退出当前应用',
    scope: 'app',
    group: 'help',
    defaultShortcut: 'Mod-q',
    menuSection: 'app',
  },
];

export const COMMAND_LOOKUP = new Map(COMMANDS.map((command) => [command.id, command]));

export const WINDOW_TITLEBAR_MENUS: Array<{
  id: string;
  label: string;
  items: Array<string | 'separator'>;
}> = [
  {
    id: 'file',
    label: '文件',
    items: [
      'file.new',
      'file.newWindow',
      'file.open',
      'file.openFolder',
      'separator',
      'file.save',
      'file.saveAs',
      'separator',
      'export.html',
      'export.pdf',
      'export.wechat',
    ],
  },
  {
    id: 'edit',
    label: '编辑',
    items: ['editor.undo', 'editor.redo', 'separator', 'edit.find', 'edit.replace', 'edit.commandPalette'],
  },
  {
    id: 'view',
    label: '视图',
    items: [
      'view.toggleSidebar',
      'view.showOutline',
      'view.showFiles',
      'separator',
      'view.toggleSourceMode',
      'view.focusMode',
      'separator',
      'view.fullscreen',
    ],
  },
  {
    id: 'help',
    label: '帮助',
    items: [
      'help.shortcuts',
      'separator',
      'settings.open',
      'help.about',
      'separator',
      'help.github',
      'help.gitee',
      'help.issues',
    ],
  },
];

export function getCommand(commandId: string): CommandDefinition | undefined {
  return COMMAND_LOOKUP.get(commandId);
}

export function getShortcut(command: CommandDefinition, customShortcuts: Record<string, string> = {}): string | null {
  return customShortcuts[command.id] ?? command.defaultShortcut ?? null;
}

export function getShortcutCommands(
  customShortcuts: Record<string, string> = {},
  options: { includePaletteOnly?: boolean } = {},
): ShortcutCommand[] {
  return COMMANDS
    .filter((command) => (options.includePaletteOnly ? command.palette !== false : true))
    .map((command) => {
      const shortcut = getShortcut(command, customShortcuts);
      if (!shortcut) return null;
      return { ...command, shortcut };
    })
    .filter((command): command is ShortcutCommand => command != null);
}

export function getShortcutGroups(customShortcuts: Record<string, string> = {}) {
  const groups = new Map<CommandGroup, ShortcutCommand[]>();

  for (const command of getShortcutCommands(customShortcuts)) {
    const current = groups.get(command.group) ?? [];
    current.push(command);
    groups.set(command.group, current);
  }

  return Array.from(groups.entries()).map(([group, items]) => ({
    group,
    name: GROUP_LABELS[group],
    items,
  }));
}

export function checkKeyConflicts(customShortcuts: Record<string, string> = {}): ShortcutCommand[] {
  const keyCount = new Map<string, number>();
  const conflicts: ShortcutCommand[] = [];

  for (const command of getShortcutCommands(customShortcuts)) {
    const count = keyCount.get(command.shortcut) ?? 0;
    if (count > 0) {
      conflicts.push(command);
    }
    keyCount.set(command.shortcut, count + 1);
  }

  return conflicts;
}

export function eventToKeyString(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.metaKey || event.ctrlKey) {
    parts.push('Mod');
  }
  if (event.metaKey && event.ctrlKey) {
    parts.push('Ctrl');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  if (event.altKey) {
    parts.push('Alt');
  }

  let key = event.key;
  if (key === ' ') {
    key = 'Space';
  } else if (key.length === 1) {
    key = key.toLowerCase();
  }

  parts.push(key);
  return parts.join('-');
}

function formatKeyForDisplay(shortcut: string, platform: 'mac' | 'win'): string {
  if (platform === 'mac') {
    return shortcut
      .replace(/Mod/g, '⌘')
      .replace(/Shift/g, '⇧')
      .replace(/Alt/g, '⌥')
      .replace(/Ctrl/g, '⌃')
      .replace(/-/g, '');
  }

  return shortcut
    .replace(/Mod/g, 'Ctrl')
    .replace(/Shift/g, 'Shift')
    .replace(/Alt/g, 'Alt')
    .replace(/Ctrl/g, 'Ctrl')
    .replace(/-/g, '+');
}

export function formatShortcutDisplay(shortcut: string): string {
  return formatKeyForDisplay(shortcut, isMac ? 'mac' : 'win');
}

const TAURI_KEY_ALIASES: Record<string, string> = {
  ',': ',',
  '.': '.',
  '/': '/',
  '\\': '\\',
  '`': '`',
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  F11: 'F11',
};

export function toTauriAccelerator(shortcut: string): string {
  const parts = shortcut.split('-');
  const modifiers: string[] = [];
  let key = '';

  for (const part of parts) {
    if (part === 'Mod') {
      modifiers.push('CmdOrCtrl');
    } else if (part === 'Shift') {
      modifiers.push('Shift');
    } else if (part === 'Alt') {
      modifiers.push('Alt');
    } else if (part === 'Ctrl') {
      modifiers.push('Ctrl');
    } else {
      key = TAURI_KEY_ALIASES[part] ?? (part.length === 1 ? part.toUpperCase() : part);
    }
  }

  return key ? [...modifiers, key].join('+') : modifiers.join('+');
}

export function getMenuShortcuts(customShortcuts: Record<string, string> = {}): Record<string, string> {
  return COMMANDS.reduce<Record<string, string>>((acc, command) => {
    if (!command.menuSection) {
      return acc;
    }
    const shortcut = getShortcut(command, customShortcuts);
    if (!shortcut) {
      return acc;
    }
    acc[command.id] = toTauriAccelerator(shortcut);
    return acc;
  }, {});
}

export function findCommandByShortcut(
  event: KeyboardEvent,
  customShortcuts: Record<string, string> = {},
): CommandDefinition | undefined {
  const key = eventToKeyString(event);
  return COMMANDS.find((command) => getShortcut(command, customShortcuts) === key);
}
