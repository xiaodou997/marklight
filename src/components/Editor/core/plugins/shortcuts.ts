/**
 * 快捷键系统
 * 跨平台兼容：Mac 使用 Cmd，Windows/Linux 使用 Ctrl
 * 支持自定义快捷键
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import { redo, undo } from 'prosemirror-history';
import { isModKey } from '../../../../utils/platform';
import { getShortcutDefinitions } from '../../../../utils/shortcuts';
import type { Schema } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';

export const shortcutsKey = new PluginKey('shortcuts');

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
