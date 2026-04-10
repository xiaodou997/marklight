# MarkLight 编辑器重构技术方案

> 日期：2026-04-10
> 目标：将编辑器从 CodeMirror 6 迁移至 TipTap (ProseMirror)，实现 Typora 风格的所见即所得编辑体验。

---

## 1. 项目背景

### 1.1 现状问题

当前编辑器基于 CodeMirror 6 的 Live Preview 模式，存在以下根本性限制：

- **代码块/表格不可在渲染态编辑**：CM6 的 `WidgetType` 是只读的，点击后必须切换为源码模式
- **样式控制困难**：装饰层和 CM6 内部样式冲突（如标题下划线问题）
- **嵌套结构支持弱**：引用块内的列表等嵌套结构需要大量 hack
- **扩展性差**：每增加一个块级元素都需要编写复杂的装饰逻辑

### 1.2 目标

构建一个 **Typora 风格的 Markdown 编辑器**：
- 编辑和渲染在同一窗口，所见即所得
- 代码块始终渲染带语法高亮，可直接编辑代码内容
- 表格始终渲染为表格，可直接编辑单元格
- 支持多套自定义主题
- 架构可扩展，便于后续增加流程图编辑等高级功能

---

## 2. 技术选型

### 2.1 编辑器框架：TipTap (ProseMirror)

| 对比项 | CodeMirror 6 | TipTap (ProseMirror) |
|--------|-------------|---------------------|
| 设计定位 | 代码编辑器 | 富文本编辑器 |
| 数据模型 | 纯文本 + 装饰层 | 结构化文档树 (Schema) |
| 代码块 | Widget 只读 | `CodeBlockLowlight` 原生可编辑 |
| 表格 | Widget 只读 | `@tiptap/extension-table` 原生可编辑 |
| 自定义节点 | Widget (只读 DOM) | NodeView (可交互、可编辑) |
| 自定义样式 | 和装饰层冲突 | DOM 结构清晰，CSS 直接控制 |
| Vue 集成 | 手动封装 | `@tiptap/vue-3` 官方支持 |

**选择 TipTap 的核心原因**：
- ProseMirror 是业界最成熟的富文本编辑器框架（Notion、Confluence、GitLab 等都在用）
- TipTap 是 ProseMirror 的 Vue 官方封装，API 更友好
- Schema-based 架构天然支持结构化内容的渲染和编辑
- 丰富的官方扩展生态，代码块、表格等开箱即用

### 2.2 Markdown 解析与序列化

- **解析 (Markdown → PM doc)**：`markdown-it` + 插件（GFM 表格、任务列表、数学公式、frontmatter）
- **序列化 (PM doc → Markdown)**：自定义 `MarkdownSerializer`，精确控制输出格式
- **选择 `markdown-it` 的原因**：`prosemirror-markdown` 内部使用 `markdown-it`，生态成熟，Typora 也使用此方案

### 2.3 不再使用 syntax-reveal

旧 ProseMirror 版本的 `syntax-reveal.ts` (929行) 采用了 "进入行→拍平为源码→离开行→解析回结构" 的方式，本质上是有损的双向转换，边界情况多。

新方案的内联源码提示（P3 阶段）将使用**纯装饰方式**：
- 光标进入 bold mark → 在 mark 边界插入 `**` 装饰 widget
- 光标离开 → 移除装饰
- 节点结构始终保持不变，不做任何转换
- 预计代码量 ~100 行

---

## 3. 核心架构设计

### 3.1 数据流

```
用户打开 .md 文件
    │
    ▼
markdown-it 解析 → ProseMirror Document Tree
    │
    ▼
TipTap EditorView 渲染（所见即所得）
    │
    ▼
用户直接在渲染态编辑
    │
    ▼
MarkdownSerializer 序列化 → .md 文件保存
```

### 3.2 目录结构

```
src/components/Editor/
├── MarkdownEditor.vue          # 主编辑器组件（TipTap）
├── SearchBar.vue               # 搜索替换（复用）
├── BubbleMenu.vue              # 浮动格式工具栏
├── tiptap/
│   ├── extensions/             # TipTap 扩展
│   │   ├── code-block.ts       # 代码块（lowlight 语法高亮）
│   │   ├── table.ts            # 表格配置
│   │   ├── image.ts            # 图片 NodeView
│   │   ├── math.ts             # 数学公式 (P2)
│   │   ├── mermaid.ts          # Mermaid 图表 (P2)
│   │   ├── callout.ts          # Callout 块 (P2)
│   │   ├── frontmatter.ts      # Frontmatter (P2)
│   │   ├── task-list.ts        # 任务列表配置
│   │   └── shortcuts.ts        # 自定义快捷键
│   ├── markdown/
│   │   ├── parser.ts           # markdown-it → PM doc
│   │   └── serializer.ts       # PM doc → markdown string
│   └── theme/
│       ├── base.css            # 基础编辑器样式
│       └── themes/             # 多套主题 (P4)
└── views/                      # NodeView Vue 组件
    ├── CodeBlockView.vue       # 代码块视图
    ├── ImageView.vue           # 图片视图
    ├── MathView.vue            # 数学公式视图 (P2)
    └── MermaidView.vue         # Mermaid 视图 (P2)
```

### 3.3 Schema 设计

**节点 (Nodes)**：
| 节点 | 说明 | 对应 Markdown |
|------|------|-------------|
| doc | 文档根节点 | - |
| paragraph | 段落 | 普通文本行 |
| heading | 标题 (level 1-6) | `# ` ~ `###### ` |
| blockquote | 引用块 | `> ` |
| bullet_list | 无序列表 | `- ` / `* ` / `+ ` |
| ordered_list | 有序列表 | `1. ` |
| list_item | 列表项 | - |
| task_list | 任务列表 | `- [ ] ` / `- [x] ` |
| task_item | 任务项 | - |
| code_block | 代码块 | ` ``` ` |
| table | 表格 | `\| ... \|` |
| table_row | 表格行 | - |
| table_header | 表头单元格 | - |
| table_cell | 表格单元格 | - |
| image | 图片 | `![alt](src)` |
| horizontal_rule | 水平线 | `---` |
| hard_break | 硬换行 | `  \n` |
| math_block | 数学公式块 (P2) | `$$...$$` |
| mermaid | Mermaid 图表 (P2) | ` ```mermaid ` |
| callout | Callout 块 (P2) | `> [!TYPE]` |
| frontmatter | Frontmatter (P2) | `---\n...\n---` |

**标记 (Marks)**：
| 标记 | 说明 | 对应 Markdown |
|------|------|-------------|
| bold | 粗体 | `**text**` |
| italic | 斜体 | `*text*` / `_text_` |
| strike | 删除线 | `~~text~~` |
| code | 行内代码 | `` `text` `` |
| link | 链接 | `[text](url)` |
| highlight | 高亮 (P1) | `==text==` |
| subscript | 下标 (P2) | `~text~` |
| superscript | 上标 (P2) | `^text^` |

---

## 4. 分阶段实施计划

### P1：核心编辑器（替换 CM6）

**目标**：功能对等替换 CM6，代码块和表格可直接编辑

- 搭建 TipTap 编辑器框架，集成到现有 Vue 项目
- 实现 Markdown 解析和序列化（所有 P1 节点和标记）
- 实现所有基础元素（标题、段落、列表、引用、任务列表、水平线）
- 实现所有内联格式（粗体、斜体、删除线、行内代码、高亮、链接）
- 实现代码块（CodeBlockLowlight，语法高亮 + 直接可编辑）
- 实现表格（可编辑单元格，Tab 导航）
- 实现图片（本地路径支持、拖拽上传）
- 对接 fileStore/settingsStore（打开、保存、自动保存）
- 实现搜索替换、快捷键、BubbleMenu
- 移除 CM6 编辑器代码和依赖

### P2：高级块类型

- 数学公式（KaTeX 渲染 + 点击编辑 LaTeX 源码）
- Mermaid 图表（渲染 + 点击编辑源码）
- Callout 块（Obsidian 风格提示框）
- Frontmatter（YAML 元数据面板）
- Wikilink 支持
- 上标/下标

### P3：Typora 风格内联源码提示

- 实现 InlineDecoPlugin（纯装饰方式，不做节点转换）
- 光标进入 bold → 显示 `**` 标记
- 光标进入 link → 显示 URL
- 光标进入 heading → 显示 `##` 前缀

### P4：高级功能

- 流程图节点可视编辑（点击修改节点值）
- 多套主题/自定义样式系统
- 斜杠命令（`/` 菜单插入块）
- 拖拽排序块
- 其他 Typora 高级特性

---

## 5. 重写范围

### 需要重写的部分
- `src/components/Editor/MarkdownEditorCM6.vue` → 新的 `MarkdownEditor.vue`
- `src/components/Editor/cm6/` 整个目录 → 新的 `tiptap/` 目录

### 保留的部分
- `src/components/Editor/SearchBar.vue` — 搜索替换 UI
- `src/components/Editor/Outline.vue` — 大纲
- `src/components/Editor/CommandPalette.vue` — 命令面板
- `src/components/Editor/ShortcutsModal.vue` — 快捷键说明
- `src/components/Editor/Sidebar.vue` — 侧边栏
- `src/stores/` — 状态管理
- `src/assets/styles/main.css` — 全局样式
- `src-tauri/` — Rust 后端
- 所有非编辑器相关组件

---

## 6. 关键依赖

```
# TipTap 核心
@tiptap/vue-3
@tiptap/starter-kit
@tiptap/pm

# 扩展
@tiptap/extension-code-block-lowlight
@tiptap/extension-table
@tiptap/extension-table-row
@tiptap/extension-table-header
@tiptap/extension-table-cell
@tiptap/extension-task-list
@tiptap/extension-task-item
@tiptap/extension-highlight
@tiptap/extension-link
@tiptap/extension-image
@tiptap/extension-placeholder

# Markdown
markdown-it
markdown-it-task-lists (或同类 GFM 任务列表插件)

# 代码高亮
lowlight
highlight.js (已有)

# 移除
@codemirror/* (全部)
@lezer/* (全部)
```
