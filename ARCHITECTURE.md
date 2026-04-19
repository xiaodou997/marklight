# MarkLight 编辑器技术架构

> 更新日期：2026-04-19
> 状态：TipTap (ProseMirror) 架构已完整实现

---

## 1. 项目背景

### 1.1 现状

编辑器已从 CodeMirror 6 完整迁移至 TipTap (ProseMirror)，实现了 Typora 风格的所见即所得编辑体验：

- **代码块/表格可在渲染态直接编辑**：使用 TipTap 的 CodeBlockLowlight 和 Table 扩展
- **样式控制清晰**：DOM 结构清晰，CSS 直接控制
- **嵌套结构支持完善**：引用块内的列表等嵌套结构原生支持
- **扩展性强**：每增加一个块级元素只需扩展 Node Schema 和 NodeView

### 1.2 目标（已实现）

构建一个 **Typora 风格的 Markdown 编辑器**：
- 编辑和渲染在同一窗口，所见即所得
- 代码块始终渲染带语法高亮，可直接编辑代码内容
- 表格始终渲染为表格，可直接编辑单元格
- 支持深色/浅色主题
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

- **解析 (Markdown → PM doc)**：`markdown-it` + 插件（GFM 表格、任务列表、数学公式、frontmatter、mark、sub、sup）
- **序列化 (PM doc → Markdown)**：自定义 `MarkdownSerializer`，精确控制输出格式
- **选择 `markdown-it` 的原因**：生态成熟，Typora 也使用此方案，插件丰富

### 2.3 Mark Token 实体化方案

**核心创新**：将行内 Markdown 语法符号（`**`、`*`、`~~`、`==`、`^`、`~`、`` ` ``）升格为真实的 ProseMirror 节点，而非使用 Decoration widget。

**优势**：
- Token 与 mark 始终同步，通过 `appendTransaction` 自动维护
- 支持直接编辑 token（Backspace 删除 token 时自动剥离 mark）
- 完美 round-trip（Markdown ↔ PM Doc ↔ Markdown 无损转换）
- 代码量更少（约 200 行 vs 旧方案的 929 行）

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
├── SearchBar.vue               # 搜索替换
├── CommandPalette.vue          # 命令面板 (Cmd+K)
├── Outline.vue                 # 大纲导航
├── ShortcutsModal.vue          # 快捷键说明
├── Sidebar.vue                 # 侧边栏（文件树）
├── tiptap/
│   ├── editor.css              # 编辑器样式
│   ├── extensions/             # TipTap 扩展
│   │   ├── callout.ts          # Callout 块（Obsidian 风格）
│   │   ├── code-block.ts       # 代码块（lowlight 语法高亮）
│   │   ├── drag-handle.ts      # 拖拽排序
│   │   ├── frontmatter.ts      # Frontmatter（YAML 元数据）
│   │   ├── heading-marker.ts  # 标题 # 前缀实体化
│   │   ├── image.ts            # 图片扩展
│   │   ├── input-rules.ts      # Markdown 输入规则
│   │   ├── link-token.ts       # 链接语法符号实体化
│   │   ├── mark-tokens.ts      # 行内标记语法符号实体化
│   │   ├── math-block.ts       # 数学公式块（KaTeX）
│   │   ├── mermaid-block.ts    # Mermaid 图表块
│   │   ├── shortcuts.ts        # 自定义快捷键
│   │   ├── slash-commands.ts   # 斜杠命令
│   │   ├── sub-sup.ts          # 上标/下标
│   │   ├── table.ts            # 表格配置
│   │   └── wikilink.ts         # Wikilink 支持
│   ├── markdown/
│   │   ├── parser.ts           # markdown-it → PM doc
│   │   ├── serializer.ts       # PM doc → markdown string
│   │   └── __tests__/          # Round-trip 测试
│   └── views/
│       ├── BubbleMenu.vue      # 浮动格式工具栏
│       └── SlashMenu.vue       # 斜杠命令菜单
```

**设计说明**：
- NodeView 直接在扩展文件中通过 `addNodeView()` 实现，无需单独的 Vue 组件文件
- 这种方式更简洁，与 TipTap 的设计理念一致

### 3.3 Schema 设计

**节点 (Nodes)**：
| 节点 | 说明 | 对应 Markdown |
|------|------|-------------|
| doc | 文档根节点 | - |
| paragraph | 段落 | 普通文本行 |
| heading | 标题 (level 1-6) | `# ` ~ `###### ` |
| headingMarker | 标题 # 前缀 | `#` 符号（实体节点）|
| blockquote | 引用块 | `> ` |
| bulletList | 无序列表 | `- ` / `* ` / `+ ` |
| orderedList | 有序列表 | `1. ` |
| listItem | 列表项 | - |
| taskList | 任务列表 | `- [ ] ` / `- [x] ` |
| taskItem | 任务项 | - |
| codeBlock | 代码块 | ` ``` ` |
| table | 表格 | `\| ... \|` |
| tableRow | 表格行 | - |
| tableHeader | 表头单元格 | - |
| tableCell | 表格单元格 | - |
| image | 图片 | `![alt](src)` |
| horizontalRule | 水平线 | `---` |
| hardBreak | 硬换行 | `  \n` |
| mathBlock | 数学公式块 | `$$...$$` |
| mermaidBlock | Mermaid 图表 | ` ```mermaid ` |
| callout | Callout 块 | `> [!TYPE]` |
| frontmatter | Frontmatter | `---\n...\n---` |
| wikilink | Wikilink | `[[page]]` / `[[page\|alias]]` |

**标记 (Marks)**：
| 标记 | 说明 | 对应 Markdown |
|------|------|-------------|
| bold | 粗体 | `**text**` |
| italic | 斜体 | `*text*` / `_text_` |
| strike | 删除线 | `~~text~~` |
| code | 行内代码 | `` `text` `` |
| link | 链接 | `[text](url)` |
| highlight | 高亮 | `==text==` |
| subscript | 下标 | `~text~` |
| superscript | 上标 | `^text^` |

**Token 节点（实体化的语法符号）**：
| 节点 | 说明 |
|------|------|
| boldToken | `**` 符号 |
| italicToken | `*` 符号 |
| strikeToken | `~~` 符号 |
| codeToken | `` ` `` 符号 |
| highlightToken | `==` 符号 |
| subscriptToken | `~` 符号 |
| superscriptToken | `^` 符号 |
| linkBracket | `[` / `]` 符号 |
| linkUrl | `(url)` 部分 |

---

## 4. 实施进度

### P1：核心编辑器 ✅ 已完成

- [x] TipTap 编辑器框架搭建
- [x] Markdown 解析与序列化（markdown-it）
- [x] 基础元素：标题、段落、列表、引用、任务列表、水平线
- [x] 内联格式：粗体、斜体、删除线、行内代码、高亮、链接
- [x] 代码块：语法高亮 + 直接可编辑
- [x] 表格：单元格直接编辑，Tab 导航
- [x] 图片：本地路径、拖拽上传
- [x] 搜索替换、快捷键、BubbleMenu
- [x] 对接 fileStore / settingsStore

### P2：高级块类型 ✅ 已完成

- [x] 数学公式（KaTeX 渲染 + 点击编辑 LaTeX）
- [x] Mermaid 图表（渲染 + 点击编辑源码）
- [x] Callout 块（Obsidian 风格提示框）
- [x] Frontmatter（YAML 元数据面板）
- [x] Wikilink 支持（`[[page]]` / `[[page|alias]]`）
- [x] 上标 / 下标（`^sup^` / `~sub~`）

### P3：Typora 风格内联源码提示 ✅ 已完成

- [x] Mark Token 实体化（将语法符号升格为真实 PM 节点）
- [x] 光标进入 bold/italic/strike/code/highlight → 显示对应标记
- [x] 光标进入 link → 显示 `[` `]` 和 `(URL)`
- [x] 光标进入 heading → 显示 `##` 前缀
- [x] appendTransaction 自动维护 token 与 mark 同步
- [x] Backspace 删除 token 时自动剥离 mark

### P4：高级功能（进行中）

- [ ] 流程图节点可视编辑
- [ ] 多套主题 / 自定义样式系统
- [x] 斜杠命令（`/` 菜单插入块）
- [x] 拖拽排序块（块级拖拽手柄）
- [ ] 快捷键自定义
- [ ] 导出增强（Word）

---

## 5. 关键实现细节

### 5.1 Mark Token 实体化

**核心机制**：
1. 解析时：将 markdown-it 解析出的 mark 边界转换为独立 token 节点
2. 编辑时：通过 `appendTransaction` hook 监听文档变化，自动维护 token 与 mark 的对应关系
3. 序列化时：跳过 token 节点（因为 mark 序列化会自动生成符号）

**关键代码位置**：
- `tiptap/extensions/mark-tokens.ts`：行内标记 token 管理
- `tiptap/extensions/link-token.ts`：链接 token 管理
- `tiptap/extensions/heading-marker.ts`：标题 # 前缀管理

### 5.2 Round-trip 测试

`tiptap/markdown/__tests__/roundtrip.spec.ts` 包含 30+ 测试用例，验证：
- 基础语法（标题、列表、引用、代码块、表格）
- 行内格式（粗体、斜体、删除线、行内代码、高亮、链接）
- 高级块（数学公式、Mermaid、Callout、Frontmatter）
- 嵌套结构（引用块内的列表、列表内的多段落）
- 边界情况（空文档、纯文本、特殊字符）

### 5.3 NodeView 实现

所有复杂节点都通过 `addNodeView()` 实现自定义渲染：

| 节点 | NodeView 实现 | 功能 |
|------|--------------|------|
| mathBlock | math-block.ts | KaTeX 渲染 + 点击编辑 |
| mermaidBlock | mermaid-block.ts | 异步加载 Mermaid + SVG 渲染 + 点击编辑 |
| frontmatter | frontmatter.ts | 可折叠面板 + YAML 显示 + 双击编辑 |
| codeBlock | code-block.ts | lowlight 语法高亮 + 直接可编辑 |

---

## 6. 技术栈总结

```
# TipTap 核心
@tiptap/vue-3
@tiptap/starter-kit
@tiptap/pm

# 扩展
@tiptap/extension-code-block-lowlight
@tiptap/extension-table
@tiptap/extension-task-list
@tiptap/extension-task-item
@tiptap/extension-highlight
@tiptap/extension-link
@tiptap/extension-image
@tiptap/extension-placeholder
@tiptap/suggestion

# Markdown
markdown-it
markdown-it-task-lists
markdown-it-mark
markdown-it-sub
markdown-it-sup

# 代码高亮
lowlight
highlight.js

# 数学公式
katex

# 图表
mermaid

# 桌面框架
tauri (v2.x)

# 前端
vue (v3.x)
pinia
tailwindcss (v4.x)
typescript
vite
```

---

## 7. 与旧架构的对比

| 方面 | 旧方案 (CM6) | 新方案 (TipTap) |
|------|-------------|-----------------|
| 代码块编辑 | Widget 只读，需切换源码 | 直接可编辑 |
| 表格编辑 | Widget 只读，需切换源码 | 直接可编辑 |
| 样式控制 | 装饰层冲突 | DOM 结构清晰 |
| 嵌套结构 | 需要 hack | 原生支持 |
| 扩展性 | 每个块需要复杂装饰逻辑 | NodeView 清晰易扩展 |
| 内联源码提示 | 不支持 | Mark Token 实体化方案 |
| Round-trip | 有损 | 完美无损 |

---

## 8. 链接

- GitHub: https://github.com/xiaodou997/marklight
- Gitee: https://gitee.com/xiaodou997/marklight