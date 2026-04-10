# MarkLight 开发路线图

## 项目定位

MarkLight 是一款跨平台 Markdown 编辑器，基于 Tauri 2.x + Vue 3 + TipTap (ProseMirror) 构建，目标是成为 Typora 的开源替代品，提供所见即所得的流畅写作体验。

---

## P1：核心编辑器重构 ✅

编辑器从 CodeMirror 6 迁移至 TipTap，实现真正的所见即所得编辑。

- [x] TipTap 编辑器框架搭建
- [x] Markdown 解析与序列化（markdown-it）
- [x] 基础元素：标题、段落、列表、引用、任务列表、水平线
- [x] 内联格式：粗体、斜体、删除线、行内代码、高亮、链接
- [x] 代码块：语法高亮 + 直接可编辑
- [x] 表格：单元格直接编辑，Tab 导航
- [x] 图片：本地路径、拖拽上传
- [x] 搜索替换、快捷键、BubbleMenu
- [x] 对接 fileStore / settingsStore

## P2：高级块类型 ✅

- [x] 数学公式（KaTeX 渲染 + 点击编辑 LaTeX）
- [x] Mermaid 图表（渲染 + 点击编辑源码）
- [x] Callout 块（Obsidian 风格提示框）
- [x] Frontmatter（YAML 元数据面板）
- [ ] Wikilink 支持
- [ ] 上标 / 下标

## P3：Typora 风格内联源码提示 ✅

- [x] InlineDecoPlugin（纯装饰方式）
- [x] 光标进入 bold/italic/strike/code/highlight → 显示对应标记
- [x] 光标进入 link → 显示 `[` `]` 和 `(URL)`
- [x] 光标进入 heading → 显示 `##` 前缀

## P4：高级功能

- [ ] 流程图节点可视编辑
- [ ] 多套主题 / 自定义样式系统
- [ ] 斜杠命令（`/` 菜单插入块）
- [ ] 拖拽排序块
- [ ] 快捷键自定义
- [ ] 导出增强（PDF、HTML、Word）

---

## 已完成功能

- [x] 文件树侧边栏（可折叠）
- [x] 大纲导航
- [x] 命令面板 (Cmd+K)
- [x] 焦点写作模式
- [x] 图片本地化存储
- [x] 搜索替换
- [x] 自动保存
- [x] 微信公众号格式导出
- [x] 跨平台快捷键支持
- [x] 深色 / 浅色主题

---

## 技术栈

- **前端框架**：Vue 3 + TypeScript + Vite
- **编辑器**：TipTap (ProseMirror)
- **桌面框架**：Tauri 2.x (Rust)
- **Markdown 解析**：markdown-it
- **代码高亮**：lowlight + highlight.js
- **状态管理**：Pinia
- **样式**：Tailwind CSS 4
- **包管理**：pnpm

## 链接

- GitHub: https://github.com/xiaodou997/marklight
- Gitee: https://gitee.com/xiaodou997/marklight
