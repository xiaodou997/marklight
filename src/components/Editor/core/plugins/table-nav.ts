/**
 * 表格导航和操作增强
 * - Tab/Shift+Tab 切换单元格
 * - 快捷键插入/删除行列
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { 
  goToNextCell, 
  addColumnBefore, 
  addColumnAfter, 
  deleteColumn,
  addRowBefore, 
  addRowAfter, 
  deleteRow,
  deleteTable,
  isInTable,
  selectedRect
} from 'prosemirror-tables';
import { isModKey } from '../../../../utils/platform';

export const tableNavKey = new PluginKey('table-nav');

/**
 * 创建表格导航插件
 */
export function createTableNavPlugin(): Plugin {
  return new Plugin({
    key: tableNavKey,
    props: {
      handleKeyDown(view, event) {
        const { state, dispatch } = view;
        
        // 只在表格内处理
        if (!isInTable(state)) {
          return false;
        }

        // Tab: 移动到下一个单元格
        if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          return goToNextCell(1)(state, dispatch);
        }

        // Shift+Tab: 移动到上一个单元格
        if (event.key === 'Tab' && event.shiftKey) {
          event.preventDefault();
          return goToNextCell(-1)(state, dispatch);
        }

        // 快捷键操作 (需要 Mod 键)
        const mod = isModKey(event);
        if (!mod) return false;

        switch (event.key.toLowerCase()) {
          // 插入行
          case 'arrowup':
            event.preventDefault();
            return addRowBefore(state, dispatch);
          
          case 'arrowdown':
            event.preventDefault();
            return addRowAfter(state, dispatch);

          // 插入列
          case 'arrowleft':
            event.preventDefault();
            return addColumnBefore(state, dispatch);
          
          case 'arrowright':
            event.preventDefault();
            return addColumnAfter(state, dispatch);

          // 删除行/列 (Backspace 或 Delete)
          case 'backspace':
          case 'delete':
            event.preventDefault();
            // 判断选区方向决定删除行还是列
            const rect = selectedRect(state);
            if (rect) {
              // 如果选中整行（多列），删除行
              // 如果选中整列（多行），删除列
              // 默认删除行
              return deleteRow(state, dispatch);
            }
            return false;
        }

        return false;
      }
    }
  });
}

// 导出操作函数供外部使用
export {
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  addRowBefore,
  addRowAfter,
  deleteRow,
  deleteTable,
  goToNextCell
};

/**
 * 获取表格操作快捷键说明
 */
export function getTableShortcuts() {
  return [
    { key: 'Tab', description: '下一个单元格' },
    { key: 'Shift+Tab', description: '上一个单元格' },
    { key: 'Mod+↑', description: '在上方插入行' },
    { key: 'Mod+↓', description: '在下方插入行' },
    { key: 'Mod+←', description: '在左侧插入列' },
    { key: 'Mod+→', description: '在右侧插入列' },
  ];
}
