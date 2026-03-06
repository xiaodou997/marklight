/**
 * 跨平台适配工具类
 */

export const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
export const isWindows = navigator.platform.toUpperCase().indexOf('WIN') >= 0;
export const isLinux = !isMac && !isWindows && navigator.platform.toUpperCase().indexOf('LINUX') >= 0;

/**
 * 判断是否按下了平台对应的修饰键 (Mac: Command, Win/Linux: Ctrl)
 */
export function isModKey(e: KeyboardEvent | MouseEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

/**
 * 格式化快捷键显示文本
 * @param shortcut 原始快捷键，例如 "CmdOrCtrl+K"
 */
export function formatShortcut(shortcut: string): string {
  if (isMac) {
    return shortcut
      .replace('CmdOrCtrl+', '⌘')
      .replace('Ctrl+', '⌘')
      .replace('Alt+', '⌥')
      .replace('Option+', '⌥')
      .replace('Shift+', '⇧');
  }
  return shortcut
    .replace('CmdOrCtrl+', 'Ctrl+')
    .replace('Meta+', 'Win+')
    .replace('Alt+', 'Alt+')
    .replace('Option+', 'Alt+')
    .replace('Shift+', 'Shift+');
}

/**
 * 获取当前平台文件管理器的名称
 */
export function getFileManagerName(): string {
  if (isMac) return 'Finder';
  if (isWindows) return '资源管理器';
  return '文件管理器';
}
