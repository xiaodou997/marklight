/**
 * 快捷键系统
 * 跨平台兼容：Mac 使用 Cmd，Windows/Linux 使用 Ctrl
 * 支持自定义快捷键
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import { redo, undo } from 'prosemirror-history';
import { isMac, isModKey } from '../../../../utils/platform';
import type { Schema } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';

export const shortcutsKey = new PluginKey('shortcuts');

// 快捷键定义类型
export interface ShortcutDef {
  id: string;           // 唯一标识符，用于自定义映射
  key: string;          // 默认快捷键
  description: string;
  macDisplay: string;
  winDisplay: string;
  group: 'format' | 'heading' | 'list' | 'block' | 'history';
}

/**
 * 默认快捷键定义
 */
export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // 格式化
  { id: 'bold', key: 'Mod-b', description: '粗体', macDisplay: '⌘B', winDisplay: 'Ctrl+B', group: 'format' },
  { id: 'italic', key: 'Mod-i', description: '斜体', macDisplay: '⌘I', winDisplay: 'Ctrl+I', group: 'format' },
  { id: 'strikethrough', key: 'Mod-Shift-x', description: '删除线', macDisplay: '⌘⇧X', winDisplay: 'Ctrl+Shift+X', group: 'format' },
  { id: 'highlight', key: 'Mod-Shift-h', description: '高亮', macDisplay: '⌘⇧H', winDisplay: 'Ctrl+Shift+H', group: 'format' },
  { id: 'code', key: 'Mod-`', description: '行内代码', macDisplay: '⌘`', winDisplay: 'Ctrl+`', group: 'format' },
  
  // 标题
  { id: 'heading1', key: 'Mod-1', description: '一级标题', macDisplay: '⌘1', winDisplay: 'Ctrl+1', group: 'heading' },
  { id: 'heading2', key: 'Mod-2', description: '二级标题', macDisplay: '⌘2', winDisplay: 'Ctrl+2', group: 'heading' },
  { id: 'heading3', key: 'Mod-3', description: '三级标题', macDisplay: '⌘3', winDisplay: 'Ctrl+3', group: 'heading' },
  { id: 'heading4', key: 'Mod-4', description: '四级标题', macDisplay: '⌘4', winDisplay: 'Ctrl+4', group: 'heading' },
  { id: 'heading5', key: 'Mod-5', description: '五级标题', macDisplay: '⌘5', winDisplay: 'Ctrl+5', group: 'heading' },
  { id: 'heading6', key: 'Mod-6', description: '六级标题', macDisplay: '⌘6', winDisplay: 'Ctrl+6', group: 'heading' },
  { id: 'paragraph', key: 'Mod-0', description: '普通段落', macDisplay: '⌘0', winDisplay: 'Ctrl+0', group: 'heading' },
  
  // 列表
  { id: 'orderedList', key: 'Mod-Shift-7', description: '有序列表', macDisplay: '⌘⇧7', winDisplay: 'Ctrl+Shift+7', group: 'list' },
  { id: 'bulletList', key: 'Mod-Shift-8', description: '无序列表', macDisplay: '⌘⇧8', winDisplay: 'Ctrl+Shift+8', group: 'list' },
  { id: 'taskList', key: 'Mod-Shift-9', description: '任务列表', macDisplay: '⌘⇧9', winDisplay: 'Ctrl+Shift+9', group: 'list' },
  
  // 块级元素
  { id: 'codeBlock', key: 'Mod-Shift-c', description: '代码块', macDisplay: '⌘⇧C', winDisplay: 'Ctrl+Shift+C', group: 'block' },
  { id: 'blockquote', key: 'Mod-Shift-q', description: '引用块', macDisplay: '⌘⇧Q', winDisplay: 'Ctrl+Shift+Q', group: 'block' },
  
  // 历史
  { id: 'undo', key: 'Mod-z', description: '撤销', macDisplay: '⌘Z', winDisplay: 'Ctrl+Z', group: 'history' },
  { id: 'redo', key: 'Mod-Shift-z', description: '重做', macDisplay: '⌘⇧Z', winDisplay: 'Ctrl+Shift+Z', group: 'history' },
];

/**
 * 获取快捷键定义（考虑自定义映射）
 */
export function getShortcutDefinitions(customShortcuts?: Record<string, string>): ShortcutDef[] {
  if (!customShortcuts || Object.keys(customShortcuts).length === 0) {
    return DEFAULT_SHORTCUTS;
  }
  
  return DEFAULT_SHORTCUTS.map(def => {
    const customKey = customShortcuts[def.id];
    if (customKey) {
      return {
        ...def,
        key: customKey,
        macDisplay: formatKeyForDisplay(customKey, 'mac'),
        winDisplay: formatKeyForDisplay(customKey, 'win'),
      };
    }
    return def;
  });
}

/**
 * 格式化快捷键显示
 */
function formatKeyForDisplay(key: string, platform: 'mac' | 'win'): string {
  if (platform === 'mac') {
    return key
      .replace(/Mod/g, '⌘')
      .replace(/Shift/g, '⇧')
      .replace(/Alt/g, '⌥')
      .replace(/-/g, '');
  }
  return key
    .replace(/Mod/g, 'Ctrl')
    .replace(/Shift/g, 'Shift')
    .replace(/Alt/g, 'Alt');
}

/**
 * 创建快捷键插件
 */
export function createShortcutsPlugin(schema: Schema, customShortcuts?: Record<string, string>): Plugin {
  // 标题命令
  const heading = (level: number) => setBlockType(schema.nodes.heading, { level });
  const paragraph = setBlockType(schema.nodes.paragraph);
  
  // 列表命令
  const bulletList = wrapInList(schema.nodes.bullet_list);
  const orderedList = wrapInList(schema.nodes.ordered_list);
  const taskList = wrapInList(schema.nodes.task_list);
  
  // 引用和代码块
  const blockquote = wrapIn(schema.nodes.blockquote);
  const codeBlock = setBlockType(schema.nodes.code_block);
  
  // 标记命令
  const strong = toggleMark(schema.marks.strong);
  const em = toggleMark(schema.marks.em);
  const strikethrough = toggleMark(schema.marks.strikethrough);
  const highlight = toggleMark(schema.marks.highlight);
  const codeMark = toggleMark(schema.marks.code);
  
  // actionId 到命令的映射
  const actionMap: Record<string, (state: EditorState, dispatch?: any, view?: any) => boolean> = {
    bold: strong,
    italic: em,
    strikethrough,
    highlight,
    code: codeMark,
    heading1: heading(1),
    heading2: heading(2),
    heading3: heading(3),
    heading4: heading(4),
    heading5: heading(5),
    heading6: heading(6),
    paragraph,
    orderedList,
    bulletList,
    taskList,
    codeBlock,
    blockquote,
    undo,
    redo,
  };
  
  // 构建快捷键映射（合并默认和自定义）
  const definitions = getShortcutDefinitions(customShortcuts);
  const keymap: Record<string, (state: EditorState, dispatch?: any, view?: any) => boolean> = {};
  
  for (const def of definitions) {
    const action = actionMap[def.id];
    if (action) {
      keymap[def.key] = action;
    }
  }

  return new Plugin({
    key: shortcutsKey,
    props: {
      handleKeyDown(view, event) {
        const { state, dispatch } = view;
        
        // 构建 ProseMirror 风格的快捷键字符串
        const key = event.key;
        const mod = isModKey(event);
        const shift = event.shiftKey;
        const alt = event.altKey;
        
        // 生成快捷键标识
        let keyId = '';
        if (mod) keyId += 'Mod-';
        if (shift) keyId += 'Shift-';
        if (alt) keyId += 'Alt-';
        keyId += key.length === 1 ? key.toLowerCase() : key;
        
        // 查找并执行命令
        const cmd = keymap[keyId];
        if (cmd) {
          event.preventDefault();
          event.stopPropagation();
          return cmd(state, dispatch, view);
        }
        
        return false;
      }
    }
  });
}

/**
 * 检测快捷键冲突
 * @returns 冲突的快捷键定义列表
 */
export function checkKeyConflicts(customShortcuts: Record<string, string>): ShortcutDef[] {
  const definitions = getShortcutDefinitions(customShortcuts);
  const keyCount = new Map<string, number>();
  const conflicts: ShortcutDef[] = [];
  
  for (const def of definitions) {
    const count = keyCount.get(def.key) || 0;
    if (count > 0) {
      conflicts.push(def);
    }
    keyCount.set(def.key, count + 1);
  }
  
  return conflicts;
}

/**
 * 将键盘事件转换为快捷键字符串
 */
export function eventToKeyString(event: KeyboardEvent): string {
  const parts: string[] = [];
  
  if (event.metaKey || event.ctrlKey) {
    parts.push('Mod');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  
  let key = event.key;
  // 规范化键名
  if (key.length === 1) {
    key = key.toLowerCase();
  } else if (key === ' ') {
    key = 'Space';
  }
  
  parts.push(key);
  return parts.join('-');
}

/**
 * 格式化快捷键显示（根据平台）
 */
export function formatShortcutDisplay(key: string): string {
  return isMac ? formatKeyForDisplay(key, 'mac') : formatKeyForDisplay(key, 'win');
}

/**
 * 获取快捷键分组
 */
export function getShortcutGroups(customShortcuts?: Record<string, string>) {
  const definitions = getShortcutDefinitions(customShortcuts);
  return [
    { name: '格式化', group: 'format' as const, items: definitions.filter(d => d.group === 'format') },
    { name: '标题', group: 'heading' as const, items: definitions.filter(d => d.group === 'heading') },
    { name: '列表', group: 'list' as const, items: definitions.filter(d => d.group === 'list') },
    { name: '块级元素', group: 'block' as const, items: definitions.filter(d => d.group === 'block') },
    { name: '历史', group: 'history' as const, items: definitions.filter(d => d.group === 'history') },
  ];
}