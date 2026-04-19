/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主色调
        primary: {
          DEFAULT: 'var(--primary-color)',
          hover: 'var(--primary-hover)',
          light: 'var(--primary-light)',
        },
        // 背景
        background: 'var(--bg-color)',
        'background-secondary': 'var(--bg-secondary)',
        // 文字
        foreground: 'var(--text-color)',
        'foreground-secondary': 'var(--text-secondary)',
        muted: 'var(--muted-color)',
        // 边框
        border: 'var(--border-color)',
        'border-light': 'var(--border-light)',
        // 侧边栏
        sidebar: 'var(--sidebar-bg)',
        'sidebar-hover': 'var(--sidebar-hover)',
        // 代码
        code: 'var(--code-bg)',
        // 状态颜色
        success: {
          DEFAULT: 'var(--success-color)',
          bg: 'var(--success-bg)',
        },
        warning: {
          DEFAULT: 'var(--warning-color)',
          bg: 'var(--warning-bg)',
        },
        error: {
          DEFAULT: 'var(--error-color)',
          bg: 'var(--error-bg)',
        },
        info: {
          DEFAULT: 'var(--info-color)',
          bg: 'var(--info-bg)',
        },
        // 弹窗
        modal: {
          bg: 'var(--modal-bg)',
          border: 'var(--modal-border)',
          overlay: 'var(--modal-overlay)',
        },
        popover: {
          bg: 'var(--popover-bg)',
          border: 'var(--popover-border)',
        },
        // 输入框
        input: {
          bg: 'var(--input-bg)',
          border: 'var(--input-border)',
          focus: 'var(--input-focus-border)',
          placeholder: 'var(--input-placeholder)',
        },
        // 按钮
        btn: {
          'primary-bg': 'var(--btn-primary-bg)',
          'primary-hover': 'var(--btn-primary-hover)',
          'primary-text': 'var(--btn-primary-text)',
          'secondary-bg': 'var(--btn-secondary-bg)',
          'secondary-hover': 'var(--btn-secondary-hover)',
          'secondary-text': 'var(--btn-secondary-text)',
          'ghost-bg': 'var(--btn-ghost-bg)',
          'ghost-hover': 'var(--btn-ghost-hover)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        popover: 'var(--popover-shadow)',
        modal: 'var(--modal-shadow)',
      },
      fontFamily: {
        mono: 'var(--font-mono)',
        text: 'var(--font-text)',
      },
    },
  },
  plugins: [],
}