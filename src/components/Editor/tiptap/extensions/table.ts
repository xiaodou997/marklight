/**
 * 表格扩展配置
 *
 * 使用 TipTap 官方表格扩展，支持：
 * - 可编辑单元格
 * - Tab/Shift+Tab 单元格导航
 * - 表头行
 */
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

export const CustomTable = Table.configure({
  resizable: false,
  HTMLAttributes: {
    class: 'mk-table',
  },
});

export const CustomTableRow = TableRow.configure({
  HTMLAttributes: {},
});

export const CustomTableHeader = TableHeader.configure({
  HTMLAttributes: {},
});

export const CustomTableCell = TableCell.configure({
  HTMLAttributes: {},
});
