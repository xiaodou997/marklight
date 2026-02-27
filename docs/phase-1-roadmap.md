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
- [x] CodeBlockView：代码块编辑 + 语言选择 + 语法高亮
- [x] ImageView：图片预览 + 路径处理
- [x] MathView：数学公式编辑 + KaTeX 渲染

### 5. 插件系统
- [x] `highlight.ts`：代码块语法高亮
- [x] `bubble-menu.ts`：选中文本格式化菜单
- [x] `image-handle.ts`：图片拖拽/粘贴处理
- [x] `smart-paste.ts`：智能粘贴
- [x] `table-toolbar.ts`：表格工具栏

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

### 8. UI 组件
- [x] MarkdownEditor：主编辑器组件
- [x] Outline：大纲视图（实时更新）
- [x] StatusBar：状态栏（字数、行列、阅读时间）
- [x] EditorToolbar：工具栏
- [x] BubbleMenu：浮动格式化菜单

### 9. 状态管理
- [x] Pinia Store：文件状态管理
- [x] 文件路径显示
- [x] 未保存标记 (`*`)

### 10. 导出功能
- [x] 微信排版导出（Inline Styles 注入）
- [x] 剪贴板复制

### 11. 性能优化
- [x] 防抖机制：大纲更新、字数统计 (400ms)
- [x] 即时响应：光标位置变化

### 12. 平台集成
- [x] macOS 原生菜单支持
- [x] 菜单事件监听

---

## 🚧 进行中 / 待完成

### Phase 2 计划
- [ ] 多标签页支持
- [ ] 自动保存
- [ ] 主题切换（浅色/深色）
- [ ] PDF 导出
- [ ] 图片本地存储优化
- [ ] 搜索替换功能
- [ ] 更多快捷键

---

## 阶段总结

通过本阶段的开发，MarkLight 已从依赖第三方库的"壳子"，进化为拥有**自主内核**的编辑器。

核心技术突破：
- **AST 驱动**：基于 ProseMirror 的文档模型
- **Vue 集成**：NodeView 系统实现 Vue 组件渲染
- **事务处理**：所有编辑操作通过 Transaction 追踪
- **性能优化**：分层更新策略，高频操作无卡顿

为后续的插件化发展和功能扩展奠定了坚实基础。