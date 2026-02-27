# Phase 1: 引擎初始化与核心功能开发

本阶段目标：建立基于 ProseMirror 的自研内核，实现 Markdown 基础编辑与高级扩展。

## ✅ 已完成任务

### 1. 架构迁移
- [x] 卸载 `vditor` 依赖
- [x] 建立 ProseMirror 编辑器内核
- [x] 实现文档架构设计

### 2. 依赖安装
- [x] 安装 `prosemirror-*` 系列核心包
- [x] 安装 `markdown-it`, `katex`, `lowlight` 辅助引擎
- [x] 配置 TypeScript 类型定义

### 3. Schema 系统
- [x] 定义基础节点：Heading, Paragraph, Blockquote, CodeBlock
- [x] 定义列表节点：BulletList, OrderedList, ListItem
- [x] 定义表格节点：Table, TableRow, TableCell
- [x] 定义扩展节点：Image, MathInline, MathBlock
- [x] 定义标记：Strong, Em, Code, Link

### 4. NodeView 系统
- [x] 实现 Vue NodeView 桥接器 (`nodeViews/index.ts`)
- [x] CodeBlockView：代码块编辑 + 语言搜索选择 + 语法高亮
- [x] ImageView：图片预览 + 相对路径解析 + 本地存储
- [x] MathView：数学公式编辑 + KaTeX 渲染 + 悬停预览气泡

### 5. 插件系统
- [x] `highlight.ts`：代码块语法高亮
- [x] `bubble-menu.ts`：选中文本格式化菜单 + 链接插入
- [x] `image-handle.ts`：图片拖拽/粘贴 + 本地化存储
- [x] `smart-paste.ts`：智能粘贴
- [x] `table-toolbar.ts`：表格工具栏
- [x] `search.ts`：搜索高亮与替换
- [x] `link-tooltip.ts`：链接悬停提示
- [x] `backspace.ts`：退格键智能处理

### 6. 输入规则
- [x] `# ` → H1-H6 标题
- [x] `> ` → 引用块
- [x] ``` → 代码块
- [x] `$...$` → 行内公式
- [x] `$$` → 块级公式

### 7. 快捷键
- [x] `Cmd/Ctrl + Z`：撤销
- [x] `Cmd/Ctrl + Y`：重做
- [x] `Cmd/Ctrl + B`：粗体
- [x] `Cmd/Ctrl + I`：斜体
- [x] `Cmd/Ctrl + F`：查找
- [x] `Cmd/Ctrl + H`：替换
- [x] `Cmd/Ctrl + S`：保存
- [x] `Cmd/Ctrl + P`：导出 PDF
- [x] `Cmd/Ctrl + Shift + P`：命令面板
- [x] `Cmd/Ctrl + Shift + F`：焦点模式

### 8. UI 组件
- [x] MarkdownEditor：主编辑器组件
- [x] Outline：大纲视图（实时更新）
- [x] StatusBar：状态栏（字数、行列、自动保存提示）
- [x] EditorToolbar：工具栏
- [x] BubbleMenu：浮动格式化菜单 + 链接插入
- [x] SearchBar：搜索替换栏
- [x] Sidebar：大纲/文件树切换
- [x] SettingsModal：设置弹窗
- [x] CommandPalette：命令面板

### 9. 状态管理
- [x] Pinia Store：文件状态管理 (file.ts)
- [x] Pinia Store：设置状态管理 (settings.ts)
- [x] 文件路径显示
- [x] 未保存标记 (`●`)
- [x] 设置持久化 (localStorage)

### 10. 导出功能
- [x] 微信排版导出（Inline Styles 注入）
- [x] 微信主题选择（5 种预设主题）
- [x] 剪贴板复制
- [x] PDF 导出（WebView 打印）

### 11. 文件操作
- [x] 新建文件
- [x] 打开文件
- [x] 打开文件夹
- [x] 保存文件
- [x] 另存为
- [x] 自动保存（可配置间隔）
- [x] 文件树右键菜单
- [x] 文件重命名
- [x] 文件删除
- [x] 新建文件/文件夹

### 12. 图片处理
- [x] 拖拽上传
- [x] 粘贴上传
- [x] 本地化存储（assets/ 目录）
- [x] 相对路径引用
- [x] 网络图片显示

### 13. 多窗口支持
- [x] Cmd+N 新建窗口
- [x] Cmd+单击在新窗口打开文件
- [x] 窗口间状态独立

### 14. 焦点模式
- [x] 隐藏侧边栏/状态栏
- [x] 内容居中窄栏显示
- [x] 悬停显示工具栏
- [x] Esc 退出

### 15. 性能优化
- [x] 防抖机制：大纲更新、字数统计 (400ms)
- [x] 即时响应：光标位置变化
- [x] 自动保存防抖

### 16. 平台集成
- [x] macOS 原生菜单支持
- [x] Windows 原生菜单支持
- [x] 菜单事件监听
- [x] GitHub Actions 跨平台构建

---

## 阶段总结

通过本阶段的开发，MarkLight 已从依赖第三方库的"壳子"，进化为拥有**自主内核**的完整编辑器。

核心技术突破：
- **AST 驱动**：基于 ProseMirror 的文档模型
- **Vue 集成**：NodeView 系统实现 Vue 组件渲染
- **事务处理**：所有编辑操作通过 Transaction 追踪
- **性能优化**：分层更新策略，高频操作无卡顿
- **本地优先**：图片本地存储，文件即时保存
- **跨平台**：Tauri 2.0 + GitHub Actions 自动构建

---

## 下一阶段计划

- [ ] 深色主题完善
- [ ] 快捷键自定义
- [ ] 更多导出格式（Word、HTML）
- [ ] 协同编辑支持
- [ ] 插件系统开放
