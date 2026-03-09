/**
 * 快捷键系统
 * 跨平台兼容：Mac 使用 Cmd，Windows/Linux 使用 Ctrl
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import { redo, undo } from 'prosemirror-history';
import type { Schema } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';

export const shortcutsKey = new PluginKey('shortcuts');

// 快捷键定义类型
interface ShortcutDef {
  key: string;
  description: string;
  macDisplay: string;
  winDisplay: string;
  action: (schema: Schema) => (state: EditorState, dispatch?: any, view?: any) => boolean;
}

// 判断是否按下修饰键 (Mac: Cmd, Win/Linux: Ctrl)
const isMod = (event: KeyboardEvent): boolean => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? event.metaKey : event.ctrlKey;
};

/**
 * 创建快捷键插件
 */
export function createShortcutsPlugin(schema: Schema): Plugin {
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
  const code = toggleMark(schema.marks.code);
  
  // 快捷键映射
  const keymap: Record<string, (state: EditorState, dispatch?: any, view?: any) => boolean> = {
    // === 格式化 ===
    'Mod-b': strong,
    'Mod-i': em,
    'Mod-Shift-x': strikethrough,  // 删除线
    'Mod-Shift-h': highlight,
    'Mod-`': code,                  // 行内代码
    
    // === 标题 ===
    'Mod-1': heading(1),
    'Mod-2': heading(2),
    'Mod-3': heading(3),
    'Mod-4': heading(4),
    'Mod-5': heading(5),
    'Mod-6': heading(6),
    'Mod-0': paragraph,             // 普通段落
    
    // === 列表 ===
    'Mod-Shift-7': orderedList,     // 有序列表 (Shift+7 = &)
    'Mod-Shift-8': bulletList,      // 无序列表 (Shift+8 = *)
    'Mod-Shift-9': taskList,        // 任务列表 (Shift+9 = ()
    
    // === 块级元素 ===
    'Mod-Shift-c': codeBlock,       // 代码块
    'Mod-Shift-q': blockquote,      // 引用
    
    // === 历史 ===
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,
  };

  return new Plugin({
    key: shortcutsKey,
    props: {
      handleKeyDown(view, event) {
        const { state, dispatch } = view;
        
        // 构建 ProseMirror 风格的快捷键字符串
        const key = event.key;
        const mod = isMod(event);
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
 * 获取所有快捷键定义（用于显示帮助）
 */
export function getShortcutDefinitions(): ShortcutDef[] {
  return [
    // 格式化
    { key: 'Mod-b', description: '粗体', macDisplay: '⌘B', winDisplay: 'Ctrl+B', action: () => () => true },
    { key: 'Mod-i', description: '斜体', macDisplay: '⌘I', winDisplay: 'Ctrl+I', action: () => () => true },
    { key: 'Mod-Shift-x', description: '删除线', macDisplay: '⌘⇧X', winDisplay: 'Ctrl+Shift+X', action: () => () => true },
    { key: 'Mod-Shift-h', description: '高亮', macDisplay: '⌘⇧H', winDisplay: 'Ctrl+Shift+H', action: () => () => true },
    { key: 'Mod-`', description: '行内代码', macDisplay: '⌘`', winDisplay: 'Ctrl+`', action: () => () => true },
    
    // 标题
    { key: 'Mod-1', description: '一级标题', macDisplay: '⌘1', winDisplay: 'Ctrl+1', action: () => () => true },
    { key: 'Mod-2', description: '二级标题', macDisplay: '⌘2', winDisplay: 'Ctrl+2', action: () => () => true },
    { key: 'Mod-3', description: '三级标题', macDisplay: '⌘3', winDisplay: 'Ctrl+3', action: () => () => true },
    { key: 'Mod-4', description: '四级标题', macDisplay: '⌘4', winDisplay: 'Ctrl+4', action: () => () => true },
    { key: 'Mod-5', description: '五级标题', macDisplay: '⌘5', winDisplay: 'Ctrl+5', action: () => () => true },
    { key: 'Mod-6', description: '六级标题', macDisplay: '⌘6', winDisplay: 'Ctrl+6', action: () => () => true },
    { key: 'Mod-0', description: '普通段落', macDisplay: '⌘0', winDisplay: 'Ctrl+0', action: () => () => true },
    
    // 列表
    { key: 'Mod-Shift-7', description: '有序列表', macDisplay: '⌘⇧7', winDisplay: 'Ctrl+Shift+7', action: () => () => true },
    { key: 'Mod-Shift-8', description: '无序列表', macDisplay: '⌘⇧8', winDisplay: 'Ctrl+Shift+8', action: () => () => true },
    { key: 'Mod-Shift-9', description: '任务列表', macDisplay: '⌘⇧9', winDisplay: 'Ctrl+Shift+9', action: () => () => true },
    
    // 块级元素
    { key: 'Mod-Shift-c', description: '代码块', macDisplay: '⌘⇧C', winDisplay: 'Ctrl+Shift+C', action: () => () => true },
    { key: 'Mod-Shift-q', description: '引用块', macDisplay: '⌘⇧Q', winDisplay: 'Ctrl+Shift+Q', action: () => () => true },
    
    // 历史
    { key: 'Mod-z', description: '撤销', macDisplay: '⌘Z', winDisplay: 'Ctrl+Z', action: () => () => true },
    { key: 'Mod-Shift-z', description: '重做', macDisplay: '⌘⇧Z', winDisplay: 'Ctrl+Shift+Z', action: () => () => true },
  ];
}

/**
 * 格式化快捷键显示（根据平台）
 */
export function formatShortcutDisplay(key: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const def = getShortcutDefinitions().find(d => d.key === key);
  if (def) {
    return isMac ? def.macDisplay : def.winDisplay;
  }
  return key;
}
