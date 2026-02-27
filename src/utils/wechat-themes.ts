/**
 * 微信导出主题配置
 */

export interface WechatTheme {
  id: string;
  name: string;
  colors: {
    primary: string;       // 主色调（标题、链接）
    primaryDark: string;   // 主色深色
    primaryLight: string;  // 主色浅色
    text: string;          // 正文颜色
    textMuted: string;     // 次要文字颜色
    codeBg: string;        // 行内代码背景
    codeColor: string;     // 行内代码文字
    blockquoteBg: string;  // 引用背景
    blockquoteBorder: string; // 引用边框
    preBg: string;         // 代码块背景
    preColor: string;      // 代码块文字
    tableBorder: string;   // 表格边框
    tableHeaderBg: string; // 表头背景
  };
}

/**
 * 预设主题列表
 */
export const WECHAT_THEMES: WechatTheme[] = [
  {
    id: 'blue',
    name: '经典蓝',
    colors: {
      primary: '#3b82f6',
      primaryDark: '#1e40af',
      primaryLight: '#1e3a8a',
      text: '#333333',
      textMuted: '#6b7280',
      codeBg: '#f3f4f6',
      codeColor: '#ef4444',
      blockquoteBg: '#f9fafb',
      blockquoteBorder: '#d1d5db',
      preBg: '#1f2937',
      preColor: '#f9fafb',
      tableBorder: '#e5e7eb',
      tableHeaderBg: '#f3f4f6',
    }
  },
  {
    id: 'green',
    name: '清新绿',
    colors: {
      primary: '#10b981',
      primaryDark: '#059669',
      primaryLight: '#047857',
      text: '#1f2937',
      textMuted: '#6b7280',
      codeBg: '#ecfdf5',
      codeColor: '#059669',
      blockquoteBg: '#f0fdf4',
      blockquoteBorder: '#86efac',
      preBg: '#1f2937',
      preColor: '#f9fafb',
      tableBorder: '#d1fae5',
      tableHeaderBg: '#ecfdf5',
    }
  },
  {
    id: 'purple',
    name: '优雅紫',
    colors: {
      primary: '#8b5cf6',
      primaryDark: '#7c3aed',
      primaryLight: '#6d28d9',
      text: '#1f2937',
      textMuted: '#6b7280',
      codeBg: '#f5f3ff',
      codeColor: '#7c3aed',
      blockquoteBg: '#faf5ff',
      blockquoteBorder: '#c4b5fd',
      preBg: '#1f2937',
      preColor: '#f9fafb',
      tableBorder: '#e9d5ff',
      tableHeaderBg: '#f5f3ff',
    }
  },
  {
    id: 'orange',
    name: '温暖橙',
    colors: {
      primary: '#f97316',
      primaryDark: '#ea580c',
      primaryLight: '#c2410c',
      text: '#1f2937',
      textMuted: '#6b7280',
      codeBg: '#fff7ed',
      codeColor: '#ea580c',
      blockquoteBg: '#fffbeb',
      blockquoteBorder: '#fdba74',
      preBg: '#1f2937',
      preColor: '#f9fafb',
      tableBorder: '#fed7aa',
      tableHeaderBg: '#fff7ed',
    }
  },
  {
    id: 'dark',
    name: '黑金风',
    colors: {
      primary: '#fbbf24',
      primaryDark: '#f59e0b',
      primaryLight: '#d97706',
      text: '#1f2937',
      textMuted: '#4b5563',
      codeBg: '#fef3c7',
      codeColor: '#b45309',
      blockquoteBg: '#fffbeb',
      blockquoteBorder: '#fcd34d',
      preBg: '#1f2937',
      preColor: '#f9fafb',
      tableBorder: '#fde68a',
      tableHeaderBg: '#fef3c7',
    }
  }
];

/**
 * 根据主题 ID 获取主题配置
 */
export function getThemeById(id: string): WechatTheme {
  return WECHAT_THEMES.find(t => t.id === id) || WECHAT_THEMES[0];
}
