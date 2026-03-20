# MarkLight 渲染架构重构：迁移至 CodeMirror 6

> 本文档为 MarkLight 编辑器从 ProseMirror 迁移至 CodeMirror 6 的完整实施指南。
> 版本：v1.0 | 日期：2026-03-20

---

## 目录

1. [背景与动机](#1-背景与动机)
2. [技术方案对比](#2-技术方案对比)
3. [CM6 核心原理](#3-cm6-核心原理)
4. [整体架构设计](#4-整体架构设计)
5. [分阶段实施计划](#5-分阶段实施计划)
6. [各模块详细实现指引](#6-各模块详细实现指引)
7. [文件清单与依赖变更](#7-文件清单与依赖变更)
8. [可复用资源清单](#8-可复用资源清单)
9. [验证方案](#9-验证方案)
10. [风险与注意事项](#10-风险与注意事项)

---

## 1. 背景与动机

### 1.1 当前方案的问题

MarkLight 当前基于 **ProseMirror** 实现 WYSIWYG Markdown 编辑。核心矛盾在于：

- **ProseMirror 是「结构优先」模型**：文档 = 节点树 + marks
- **用户期望的是「源码优先」模型**：光标进入行时显示可编辑的 Markdown 定界符

当前的「行级源码模式」方案通过 `appendTransaction` 在进入/离开行时 **修改文档结构** 来模拟源码编辑，存在以下不可根治的问题：

| 问题 | 原因 | 影响 |
|------|------|------|
| **文档突变** | 每次进出行都修改文档 | undo 污染（即使 `addToHistory: false`） |
| **状态跳变** | marks 消失/出现导致文字重排 | 光标跳动、视觉闪烁 |
| **选区断裂** | 无法同时覆盖「源码行」和「渲染行」 | 跨行选区行为异常 |
| **边界 case 多** | ProseMirror 的 `seen` 缓存、位置映射 | 定界符交替显示/不显示 bug |
| **性能开销** | 每次行切换触发文档变更 | DOM 重绘 |

**根因**：ProseMirror 的文档模型中 **不存在 Markdown 源码文本**，只能通过修改文档来「注入」。

### 1.2 为什么选择 CodeMirror 6

CM6 是 **源码优先** 模型：文档就是 Markdown 纯文本。格式化渲染通过 Decoration（视觉覆盖层）实现，**永不修改文档**。这与 **Obsidian 的 Live Preview** 原理完全一致。

**核心优势**：

- **永不修改文档**：undo/redo 完全正常，无需 `addToHistory: false` hack
- **无状态跳变**：文本始终是 Markdown 源码，只是「穿了不同的衣服」
- **选区天然正确**：跨行选区直接作用于源文本
- **性能极佳**：只改 Decoration（轻量），不触发文档变更
- **定界符天然可编辑**：它们就是文档中的真实字符
- **文件 I/O 零成本**：`doc.toString()` 即为 Markdown 文本，无需 parse/serialize

---

## 2. 技术方案对比

### 2.1 ProseMirror vs CodeMirror 6

```
ProseMirror（当前方案）：
文档内容：  { type: "heading", attrs: {level: 2}, content: [{type: "text", marks: [{type: "strong"}], text: "world"}] }
光标进入行 → appendTransaction 修改文档 → 把 marks 拆开变成源文本 "## Hello **world**"
光标离开行 → appendTransaction 修改文档 → 把源文本解析回 marks + nodes
             ↑ 每次都改文档 → undo 污染、光标跳动、位置映射复杂

CodeMirror 6（目标方案）：
文档内容：  "## Hello **world**"     ← 始终是纯文本
光标不在此行 → Decoration.replace 隐藏 "## " 和 "**"，应用标题+加粗样式
光标进入此行 → 移除该行的 Decoration → 源码自然显示 → 用户直接编辑文本
光标离开此行 → 重新添加 Decoration → 回到渲染视图
               ↑ 永不改文档 → undo 干净、选区正确、性能好
```

### 2.2 已有 CM6 Live Preview 库

| 库 | 特点 | 推荐度 |
|---|---|---|
| [`codemirror-live-markdown`](https://github.com/nickmartinezreiner/codemirror-live-markdown) | 模块化插件集，Obsidian 风格，KaTeX/代码高亮可选 | ⭐⭐⭐ **最推荐** |
| [`codemirror-rich-markdoc`](https://github.com/nickmartinezreiner/codemirror-rich-markdoc) | 双层策略（CSS 隐藏 + widget 替换） | ⭐⭐ 架构参考 |
| [`ink-mde`](https://github.com/davidmyersdev/ink-mde) | 完整编辑器，有 Vue wrapper | ⭐⭐ UI 参考 |
| [`@yuya296/cm6-live-preview-core`](https://www.npmjs.com/package/@yuya296/cm6-live-preview-core) | 极简核心，纯 Decoration 方案 | ⭐ 底层参考 |

**建议**：以 `codemirror-live-markdown` 为基础，扩展 MarkLight 特有功能（任务列表、脚注、定义列表等）。

---

## 3. CM6 核心原理

### 3.1 CM6 核心概念

```
┌──────────────────────────────────────────────┐
│                EditorView                      │
│  ┌──────────────────────────────────────────┐ │
│  │             EditorState                    │ │
│  │  ┌────────────────────────────────────┐   │ │
│  │  │  doc: Text  ("## Hello **world**")  │   │ │  ← 纯文本
│  │  │  selection: EditorSelection         │   │ │  ← 光标/选区
│  │  │  extensions: Extension[]            │   │ │  ← 插件
│  │  └────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Decorations（视觉覆盖层，不改文档）：          │
│  ├─ Decoration.mark    → 应用 CSS 类           │
│  ├─ Decoration.replace → 隐藏文本或替换为 widget│
│  └─ Decoration.widget  → 在位置插入 DOM 元素   │
│                                                │
│  ViewPlugin → 管理 DecorationSet              │
│  WidgetType  → 自定义 DOM 渲染                 │
│  StateField  → 存储插件状态                    │
│  Facet       → 可组合的扩展配置                │
└──────────────────────────────────────────────┘
```

### 3.2 Lezer Markdown 语法树

CM6 使用 [Lezer](https://lezer.codemirror.net/) 增量解析器。`@codemirror/lang-markdown` 内置的 Lezer Markdown parser 生成如下语法树节点：

```
标题：          ATXHeading1, ATXHeading2, ATXHeading3, ATXHeading4, ATXHeading5, ATXHeading6
               └─ HeaderMark ("## ")
加粗：          StrongEmphasis
               └─ EmphasisMark ("**")
斜体：          Emphasis
               └─ EmphasisMark ("*")
行内代码：      InlineCode
               └─ CodeMark ("`")
链接：          Link
               ├─ LinkMark ("[", "]")
               ├─ LinkLabel (文本)
               └─ URL ("(url)")
图片：          Image
引用块：        Blockquote
               └─ QuoteMark ("> ")
无序列表：      BulletList → ListItem → ListMark ("- ")
有序列表：      OrderedList → ListItem → ListMark ("1. ")
围栏代码块：    FencedCode
               ├─ CodeMark ("```")
               └─ CodeInfo ("language")
分隔线：        HorizontalRule
```

**扩展语法**需要通过 `@lezer/markdown` 的 `MarkdownConfig` 扩展 parser（详见 Phase 5）。

### 3.3 Decoration 工作原理

```ts
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// 1. Decoration.mark — 给文本范围添加 CSS 类（文本仍可见可编辑）
Decoration.mark({ class: 'cm-heading cm-heading-2' }).range(from, to)

// 2. Decoration.replace — 隐藏文本范围（或替换为 widget）
Decoration.replace({}).range(from, to)                          // 纯隐藏
Decoration.replace({ widget: new CodeBlockWidget(src, lang) })  // 替换为 widget

// 3. Decoration.widget — 在某位置插入 DOM 元素（不替换文本）
Decoration.widget({ widget: new CheckboxWidget(checked), side: -1 }).range(pos)

// 关键：所有 Decoration 都不修改文档！只改视觉呈现。
```

---

## 4. 整体架构设计

### 4.1 系统架构图

```
┌────────────────────────────────────────────────────────┐
│                    Vue 3 + Pinia                        │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ TitleBar │  │   Sidebar    │  │    StatusBar     │  │
│  └──────────┘  └──────────────┘  └─────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           MarkdownEditorCM6.vue                  │   │
│  │                                                   │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │           CodeMirror 6 EditorView            │ │   │
│  │  │                                               │ │   │
│  │  │  Extensions（按加载顺序）：                    │ │   │
│  │  │  1. @codemirror/lang-markdown  (语法解析)     │ │   │
│  │  │  2. @codemirror/history        (undo/redo)    │ │   │
│  │  │  3. livePreviewExtension       (核心渲染)     │ │   │
│  │  │  4. codeBlockWidgetExtension   (代码块)       │ │   │
│  │  │  5. mathWidgetExtension        (数学公式)     │ │   │
│  │  │  6. imageWidgetExtension       (图片预览)     │ │   │
│  │  │  7. mermaidWidgetExtension     (图表渲染)     │ │   │
│  │  │  8. tableWidgetExtension       (表格渲染)     │ │   │
│  │  │  9. taskListExtension          (任务列表)     │ │   │
│  │  │ 10. shortcutsExtension         (快捷键)       │ │   │
│  │  │ 11. searchExtension            (搜索替换)     │ │   │
│  │  │ 12. bubbleMenuExtension        (浮动菜单)     │ │   │
│  │  │ 13. smartPasteExtension        (智能粘贴)     │ │   │
│  │  │ 14. imageDropExtension         (图片拖放)     │ │   │
│  │  │ 15. themeExtension             (主题样式)     │ │   │
│  │  └─────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  可直接复用（无需改动）：                                │
│  ├─ composables/useFileOperations.ts                    │
│  ├─ composables/useFileTree.ts                          │
│  ├─ composables/useExportActions.ts                     │
│  ├─ composables/useImagePreview.ts                      │
│  ├─ composables/useWindowEvents.ts                      │
│  ├─ composables/useMenuEvents.ts                        │
│  ├─ stores/file.ts                                      │
│  ├─ stores/settings.ts                                  │
│  └─ src-tauri/* (Rust 后端)                             │
└────────────────────────────────────────────────────────┘
```

### 4.2 文件 I/O 对比

```ts
// ==================== 当前 ProseMirror 方式 ====================
// 读取文件 → 解析为 PM 文档树（复杂）
import { parseMarkdown, serializeMarkdown } from './core/markdown';
const doc = parseMarkdown(markdownString, mySchema);  // markdown-it → PM Doc

// 保存文件 → 序列化回 Markdown 字符串（复杂，易丢失格式）
const markdown = serializeMarkdown(editorView.state.doc);

// ==================== CM6 方式 ====================
// 读取文件 → 直接设置文本（零成本）
view.dispatch({
  changes: { from: 0, to: view.state.doc.length, insert: markdownString }
});

// 保存文件 → 直接获取文本（零成本）
const markdown = view.state.doc.toString();
```

---

## 5. 分阶段实施计划

### Phase 0：准备工作

**目标**：搭建 CM6 开发环境，与现有编辑器并行运行

**任务清单**：

- [ ] 安装 CM6 依赖包（见 [7.2 依赖变更](#72-依赖变更)）
- [ ] 创建 `src/components/Editor/MarkdownEditorCM6.vue` 骨架组件
- [ ] 创建 `src/components/Editor/cm6/` 目录结构：
  ```
  cm6/
  ├── extensions/
  │   ├── live-preview.ts
  │   ├── code-block-widget.ts
  │   ├── math-widget.ts
  │   ├── image-widget.ts
  │   ├── mermaid-widget.ts
  │   ├── table-widget.ts
  │   ├── task-list.ts
  │   ├── shortcuts.ts
  │   ├── search.ts
  │   ├── bubble-menu.ts
  │   ├── smart-paste.ts
  │   └── image-drop.ts
  ├── theme.ts
  └── markdown-extensions.ts
  ```
- [ ] 在设置中添加 `editorEngine: 'prosemirror' | 'codemirror'` 开关
- [ ] 在父组件中根据开关加载不同编辑器组件

**参考实现**（设置开关）：

```ts
// stores/settings.ts — 新增字段
export interface Settings {
  // ... 现有字段
  /** 编辑器引擎 */
  editorEngine: 'prosemirror' | 'codemirror';
}

const DEFAULT_SETTINGS: Settings = {
  // ... 现有默认值
  editorEngine: 'prosemirror',  // 默认使用旧引擎，开发期间手动切换
};
```

```vue
<!-- 父组件中条件加载 -->
<MarkdownEditorCM6
  v-if="settingsStore.settings.editorEngine === 'codemirror'"
  :initial-content="content"
  @update="onUpdate"
/>
<MarkdownEditor
  v-else
  :initial-content="content"
  @update="onUpdate"
/>
```

---

### Phase 1：基础编辑器

**目标**：CM6 能正常加载 Markdown 文件并编辑

**任务清单**：

- [ ] CM6 EditorView 初始化
- [ ] 集成 `@codemirror/lang-markdown` 语法高亮
- [ ] 文件读写集成（复用 `useFileOperations`）
- [ ] 基础快捷键（undo/redo, 加粗/斜体等）
- [ ] 主题样式（复用现有 CSS 变量体系）
- [ ] `dispatchTransaction` 等效逻辑（文档变更通知 fileStore）

**参考实现**（`MarkdownEditorCM6.vue` 骨架）：

```vue
<template>
  <div
    class="editor-shell h-full w-full cursor-text transition-colors"
    style="background-color: var(--bg-color);"
  >
    <div ref="editorRef" class="cm6-editor h-full px-12 py-8 overflow-y-auto outline-none"></div>

    <!-- 复用现有搜索栏 -->
    <SearchBar
      ref="searchBarRef"
      :visible="isSearchVisible"
      :match-count="searchMatchCount"
      :current-index="searchCurrentIndex"
      @query="onSearchQuery"
      @next="onSearchNext"
      @prev="onSearchPrev"
      @replace="onSearchReplace"
      @replace-all="onSearchReplaceAll"
      @close="closeSearch"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { useFileStore } from '../../stores/file'
import { useSettingsStore } from '../../stores/settings'
import { debounce } from 'lodash-es'

// 导入自定义 extensions（Phase 2+ 逐步添加）
// import { livePreviewExtension } from './cm6/extensions/live-preview'
// import { shortcutsExtension } from './cm6/extensions/shortcuts'
// import { markdownTheme } from './cm6/theme'

import SearchBar from './SearchBar.vue'

const props = defineProps<{ initialContent?: string }>()
const emit = defineEmits<{ (e: 'update', data: any): void }>()

const fileStore = useFileStore()
const settingsStore = useSettingsStore()
const editorRef = ref<HTMLElement | null>(null)
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null)
const isSearchVisible = ref(false)
const searchMatchCount = ref(0)
const searchCurrentIndex = ref(0)

let view: EditorView | null = null

// 防抖更新统计信息
const debouncedUpdate = debounce((state: EditorState) => {
  const text = state.doc.toString()

  // 字数统计（复用现有逻辑）
  const wordCount =
    (text.match(/[\u4e00-\u9fa5]/g) || []).length +
    (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9_-]+/g) || []).length

  // 大纲提取
  const outline: { text: string; level: number; pos: number }[] = []
  const lines = text.split('\n')
  let pos = 0
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/)
    if (match) {
      outline.push({ text: match[2], level: match[1].length, pos })
    }
    pos += line.length + 1
  }

  // 光标位置
  const head = state.selection.main.head
  const lineInfo = state.doc.lineAt(head)
  const cursor = { line: lineInfo.number, col: head - lineInfo.from + 1 }

  // 选中文本
  const { from, to } = state.selection.main
  const selectionText = from !== to ? state.doc.sliceString(from, to) : ''

  emit('update', { wordCount, outline, selectionText, cursor })
}, 400)

onMounted(() => {
  if (!editorRef.value) return

  const startState = EditorState.create({
    doc: props.initialContent || '',
    extensions: [
      // 基础
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(defaultHighlightStyle),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),

      // 文档变更监听
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          fileStore.markUserEdit()
          fileStore.setContent(update.state.doc.toString())
          debouncedUpdate(update.state)
        } else if (update.selectionSet) {
          debouncedUpdate(update.state)
        }
      }),

      // 基础样式
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit' },
        '.cm-content': {
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          lineHeight: '1.6',
          padding: '0',
        },
      }),

      // TODO: Phase 2 添加 livePreviewExtension
      // TODO: Phase 3 添加 widget extensions
      // TODO: Phase 4 添加交互 extensions
    ],
  })

  view = new EditorView({
    state: startState,
    parent: editorRef.value,
  })

  // 初始统计
  debouncedUpdate(view.state)
  view.focus()
})

onUnmounted(() => {
  debouncedUpdate.cancel()
  view?.destroy()
  view = null
})

// 搜索功能占位（Phase 4 实现）
function onSearchQuery(_query: string) { /* TODO */ }
function onSearchNext() { /* TODO */ }
function onSearchPrev() { /* TODO */ }
function onSearchReplace(_replacement: string) { /* TODO */ }
function onSearchReplaceAll(_replacement: string) { /* TODO */ }
function closeSearch() { isSearchVisible.value = false }

defineExpose({
  scrollToPos: (pos: number) => {
    if (!view) return
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    })
  },
  getContent: () => view?.state.doc.toString() ?? '',
  getEditorView: () => view,
  openSearch: () => { isSearchVisible.value = true },
  closeSearch,
})
</script>
```

---

### Phase 2：Live Preview 核心（最关键阶段）

**目标**：实现光标行显示源码、非光标行显示渲染效果的核心体验

**任务清单**：

- [ ] 实现 `LivePreviewPlugin` — 核心 ViewPlugin
- [ ] 标题渲染：隐藏 `##` 前缀，应用标题字号（h1-h6）
- [ ] 行内格式：隐藏 `**`/`*`/`~~`/`` ` ``/`==` 定界符，应用对应样式
- [ ] 引用块：隐藏 `>` 前缀，应用引用样式（左边框 + 灰色文字）
- [ ] 列表：隐藏 `-`/`*`/`1.` 标记，应用列表缩进
- [ ] 链接：隐藏 `[text](url)` 语法，显示可点击链接文本
- [ ] 分隔线：替换为 `<hr>` 元素
- [ ] 定界符灰色着色：光标所在行的语法标记用 `Decoration.mark` 上灰色

**核心实现**（`cm6/extensions/live-preview.ts`）：

```ts
import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { EditorState, Range, RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

// ============================================================
// 辅助函数
// ============================================================

/** 判断光标是否在指定行范围内 */
function isCursorInRange(
  state: EditorState,
  from: number,
  to: number
): boolean {
  const sel = state.selection.main
  // 获取 from..to 覆盖的行范围
  const startLine = state.doc.lineAt(from).number
  const endLine = state.doc.lineAt(to).number
  const cursorLine = state.doc.lineAt(sel.head).number
  return cursorLine >= startLine && cursorLine <= endLine
}

/** 获取选区覆盖的所有行号 */
function getSelectionLines(state: EditorState): Set<number> {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number
    const endLine = state.doc.lineAt(range.to).number
    for (let i = startLine; i <= endLine; i++) {
      lines.add(i)
    }
  }
  return lines
}

// ============================================================
// Decoration 样式
// ============================================================

const headingStyles: Record<number, Decoration> = {
  1: Decoration.mark({ class: 'cm-heading cm-heading-1' }),
  2: Decoration.mark({ class: 'cm-heading cm-heading-2' }),
  3: Decoration.mark({ class: 'cm-heading cm-heading-3' }),
  4: Decoration.mark({ class: 'cm-heading cm-heading-4' }),
  5: Decoration.mark({ class: 'cm-heading cm-heading-5' }),
  6: Decoration.mark({ class: 'cm-heading cm-heading-6' }),
}

const boldDeco = Decoration.mark({ class: 'cm-strong' })
const italicDeco = Decoration.mark({ class: 'cm-em' })
const strikeDeco = Decoration.mark({ class: 'cm-strikethrough' })
const codeDeco = Decoration.mark({ class: 'cm-inline-code' })
const highlightDeco = Decoration.mark({ class: 'cm-highlight' })

// 语法标记灰色（光标所在行使用）
const syntaxMarkDeco = Decoration.mark({ class: 'cm-syntax-mark' })

// 隐藏用（光标不在时使用）
const hiddenDeco = Decoration.replace({})

// ============================================================
// LivePreviewPlugin
// ============================================================

class LivePreviewPlugin {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    // 文档变化、选区变化、视口变化时重建 decorations
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const { state } = view
    const activeLines = getSelectionLines(state)
    const decorations: Range<Decoration>[] = []

    // 只处理当前视口范围（性能优化）
    for (const { from, to } of view.visibleRanges) {
      syntaxTree(state).iterate({
        from,
        to,
        enter: (node) => {
          this.processNode(state, node, activeLines, decorations)
        },
      })
    }

    // 按位置排序（DecorationSet 要求有序）
    decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)

    return Decoration.set(decorations)
  }

  processNode(
    state: EditorState,
    node: SyntaxNode,
    activeLines: Set<number>,
    decorations: Range<Decoration>[]
  ) {
    const nodeLine = state.doc.lineAt(node.from).number
    const isActive = activeLines.has(nodeLine)

    switch (node.name) {
      // ─── 标题 ───
      case 'ATXHeading1':
      case 'ATXHeading2':
      case 'ATXHeading3':
      case 'ATXHeading4':
      case 'ATXHeading5':
      case 'ATXHeading6': {
        const level = parseInt(node.name.slice(-1))
        if (isActive) {
          // 光标在此行：显示源码，但 ## 标灰色
          const headerMark = node.getChild('HeaderMark')
          if (headerMark) {
            decorations.push(syntaxMarkDeco.range(headerMark.from, headerMark.to))
          }
          // 内容部分仍应用标题样式
          decorations.push(headingStyles[level].range(node.from, node.to))
        } else {
          // 光标不在：隐藏 ## 前缀，应用标题样式
          const headerMark = node.getChild('HeaderMark')
          if (headerMark) {
            // 隐藏 "## "（包含后面的空格）
            const hideEnd = Math.min(headerMark.to + 1, node.to)
            decorations.push(hiddenDeco.range(headerMark.from, hideEnd))
          }
          decorations.push(headingStyles[level].range(node.from, node.to))
        }
        break
      }

      // ─── 加粗 **text** ───
      case 'StrongEmphasis': {
        if (isActive) {
          // 光标在此行：** 标灰色，内容加粗
          this.markDelimiters(state, node, 'EmphasisMark', decorations)
          decorations.push(boldDeco.range(node.from, node.to))
        } else {
          // 光标不在：隐藏 **，内容加粗
          this.hideDelimiters(state, node, 'EmphasisMark', decorations)
          decorations.push(boldDeco.range(node.from, node.to))
        }
        break
      }

      // ─── 斜体 *text* ───
      case 'Emphasis': {
        if (isActive) {
          this.markDelimiters(state, node, 'EmphasisMark', decorations)
          decorations.push(italicDeco.range(node.from, node.to))
        } else {
          this.hideDelimiters(state, node, 'EmphasisMark', decorations)
          decorations.push(italicDeco.range(node.from, node.to))
        }
        break
      }

      // ─── 行内代码 `code` ───
      case 'InlineCode': {
        if (isActive) {
          this.markDelimiters(state, node, 'CodeMark', decorations)
          decorations.push(codeDeco.range(node.from, node.to))
        } else {
          this.hideDelimiters(state, node, 'CodeMark', decorations)
          decorations.push(codeDeco.range(node.from, node.to))
        }
        break
      }

      // ─── 删除线 ~~text~~ ───
      case 'Strikethrough': {
        if (isActive) {
          this.markDelimiters(state, node, 'StrikethroughMark', decorations)
          decorations.push(strikeDeco.range(node.from, node.to))
        } else {
          this.hideDelimiters(state, node, 'StrikethroughMark', decorations)
          decorations.push(strikeDeco.range(node.from, node.to))
        }
        break
      }

      // ─── 引用块 > text ───
      case 'Blockquote': {
        // 引用块可能跨多行，需要逐行处理
        // 每一行的 QuoteMark ("> ") 需要单独处理
        break  // 子节点 QuoteMark 会被单独遍历
      }
      case 'QuoteMark': {
        if (isActive) {
          decorations.push(syntaxMarkDeco.range(node.from, node.to))
        } else {
          decorations.push(hiddenDeco.range(node.from, node.to))
        }
        break
      }

      // ─── 链接 [text](url) ───
      case 'Link': {
        if (!isActive) {
          // 隐藏 [ ] ( url )，只显示链接文本
          const children = []
          let cursor = node.cursor()
          if (cursor.firstChild()) {
            do {
              children.push({ name: cursor.name, from: cursor.from, to: cursor.to })
            } while (cursor.nextSibling())
          }

          for (const child of children) {
            if (child.name === 'LinkMark' || child.name === 'URL') {
              decorations.push(hiddenDeco.range(child.from, child.to))
            }
          }
          // 链接文本应用链接样式
          decorations.push(
            Decoration.mark({ class: 'cm-link', tagName: 'a' }).range(node.from, node.to)
          )
        } else {
          // 光标在：全部显示，链接标记灰色
          const children = []
          let cursor = node.cursor()
          if (cursor.firstChild()) {
            do {
              children.push({ name: cursor.name, from: cursor.from, to: cursor.to })
            } while (cursor.nextSibling())
          }
          for (const child of children) {
            if (child.name === 'LinkMark' || child.name === 'URL') {
              decorations.push(syntaxMarkDeco.range(child.from, child.to))
            }
          }
        }
        break
      }

      // ─── 列表标记 ───
      case 'ListMark': {
        if (isActive) {
          decorations.push(syntaxMarkDeco.range(node.from, node.to))
        } else {
          // 列表标记不隐藏，但可以考虑用 CSS 美化
          // 或者隐藏原始标记，用 CSS list-style 替代
        }
        break
      }

      // ─── 分隔线 --- ───
      case 'HorizontalRule': {
        if (!isActive) {
          decorations.push(
            Decoration.replace({
              widget: new HRWidget(),
            }).range(node.from, node.to)
          )
        }
        break
      }
    }
  }

  /** 给语法标记添加灰色样式（光标所在行） */
  private markDelimiters(
    _state: EditorState,
    node: SyntaxNode,
    markName: string,
    decorations: Range<Decoration>[]
  ) {
    let cursor = node.cursor()
    if (cursor.firstChild()) {
      do {
        if (cursor.name === markName) {
          decorations.push(syntaxMarkDeco.range(cursor.from, cursor.to))
        }
      } while (cursor.nextSibling())
    }
  }

  /** 隐藏语法标记（光标不在行） */
  private hideDelimiters(
    _state: EditorState,
    node: SyntaxNode,
    markName: string,
    decorations: Range<Decoration>[]
  ) {
    let cursor = node.cursor()
    if (cursor.firstChild()) {
      do {
        if (cursor.name === markName) {
          decorations.push(hiddenDeco.range(cursor.from, cursor.to))
        }
      } while (cursor.nextSibling())
    }
  }
}

// ============================================================
// 简单 Widget
// ============================================================

class HRWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-hr'
    return hr
  }
  eq() { return true }
}

// ============================================================
// 导出
// ============================================================

export const livePreviewExtension = ViewPlugin.fromClass(LivePreviewPlugin, {
  decorations: (v) => v.decorations,
})
```

**配套 CSS**（`cm6/theme.ts`）：

```ts
import { EditorView } from '@codemirror/view'

export const markdownTheme = EditorView.theme({
  // 标题样式
  '.cm-heading-1': { fontSize: '2.25rem', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3em' },
  '.cm-heading-2': { fontSize: '1.875rem', fontWeight: '700' },
  '.cm-heading-3': { fontSize: '1.5rem', fontWeight: '600' },
  '.cm-heading-4': { fontSize: '1.25rem', fontWeight: '600' },
  '.cm-heading-5': { fontSize: '1.125rem', fontWeight: '600' },
  '.cm-heading-6': { fontSize: '1rem', fontWeight: '600' },

  // 行内格式
  '.cm-strong': { fontWeight: 'bold' },
  '.cm-em': { fontStyle: 'italic' },
  '.cm-strikethrough': { textDecoration: 'line-through', color: '#9ca3af' },
  '.cm-inline-code': {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.9em',
    backgroundColor: 'var(--sidebar-bg)',
    padding: '1px 4px',
    borderRadius: '3px',
  },
  '.cm-highlight': { backgroundColor: '#fef08a', padding: '1px 2px', borderRadius: '2px' },
  '.cm-link': { color: 'var(--primary-color)', textDecoration: 'underline', cursor: 'pointer' },

  // 语法标记灰色
  '.cm-syntax-mark': {
    color: '#9ca3af',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
  },

  // 分隔线
  '.cm-hr': {
    border: 'none',
    borderTop: '1px solid var(--border-color)',
    margin: '1em 0',
  },
})
```

---

### Phase 3：复杂块 Widget

**目标**：代码块、数学公式、图片、Mermaid 图表、表格的 Widget 渲染

**任务清单**：

- [ ] **代码块 Widget**：语法高亮（highlight.js） + 语言选择器 + 复制按钮
- [ ] **数学公式 Widget**：KaTeX 渲染（行内 `$...$` + 块级 `$$...$$`）
- [ ] **图片 Widget**：图片预览 + 尺寸调整
- [ ] **Mermaid Widget**：图表渲染
- [ ] **表格 Widget**：渲染为 HTML 表格 + 点击进入源码编辑

**代码块 Widget 详细实现**（`cm6/extensions/code-block-widget.ts`）：

```ts
import { EditorView, WidgetType, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { Range } from '@codemirror/state'
import hljs from 'highlight.js'

class CodeBlockWidget extends WidgetType {
  constructor(
    private source: string,
    private lang: string,
    private nodeFrom: number
  ) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'code-block-wrapper group relative my-2 rounded-lg border border-gray-200 bg-gray-50'

    // 工具栏
    const toolbar = document.createElement('div')
    toolbar.className = 'flex items-center justify-between border-b border-gray-100 px-4 py-2 text-xs text-gray-400'
    toolbar.innerHTML = `
      <span class="font-mono uppercase tracking-wider">${this.lang || 'text'}</span>
      <button class="copy-btn opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-500">复制</button>
    `

    // 复制按钮事件
    const copyBtn = toolbar.querySelector('.copy-btn')!
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      navigator.clipboard.writeText(this.source).then(() => {
        copyBtn.textContent = '已复制'
        setTimeout(() => { copyBtn.textContent = '复制' }, 2000)
      })
    })

    // 代码内容
    const pre = document.createElement('pre')
    pre.className = 'overflow-x-auto p-4 text-sm'
    const code = document.createElement('code')
    code.className = `language-${this.lang}`

    try {
      if (this.lang && hljs.getLanguage(this.lang)) {
        code.innerHTML = hljs.highlight(this.source, { language: this.lang }).value
      } else {
        code.textContent = this.source
      }
    } catch {
      code.textContent = this.source
    }

    pre.appendChild(code)
    wrapper.appendChild(toolbar)
    wrapper.appendChild(pre)

    // 点击进入编辑（移动光标到代码块位置）
    wrapper.addEventListener('click', () => {
      view.dispatch({
        selection: { anchor: this.nodeFrom + 1 }, // 跳过 ```
      })
      view.focus()
    })

    return wrapper
  }

  eq(other: CodeBlockWidget) {
    return this.source === other.source && this.lang === other.lang
  }

  get estimatedHeight() {
    return Math.max(60, this.source.split('\n').length * 20 + 40)
  }
}

// ViewPlugin 管理代码块 decorations
class CodeBlockPlugin {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.build(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.build(update.view)
    }
  }

  build(view: EditorView): DecorationSet {
    const { state } = view
    const decorations: Range<Decoration>[] = []
    const cursorLine = state.doc.lineAt(state.selection.main.head).number

    syntaxTree(state).iterate({
      enter(node) {
        if (node.name === 'FencedCode') {
          const startLine = state.doc.lineAt(node.from).number
          const endLine = state.doc.lineAt(node.to).number

          // 光标在代码块内 → 显示源码
          if (cursorLine >= startLine && cursorLine <= endLine) return

          // 提取语言和代码内容
          const fullText = state.doc.sliceString(node.from, node.to)
          const firstNewline = fullText.indexOf('\n')
          const lastNewline = fullText.lastIndexOf('\n')

          const firstLine = fullText.slice(0, firstNewline)
          const lang = firstLine.replace(/^`+/, '').trim()
          const source = firstNewline < lastNewline
            ? fullText.slice(firstNewline + 1, lastNewline)
            : ''

          decorations.push(
            Decoration.replace({
              widget: new CodeBlockWidget(source, lang, node.from),
            }).range(node.from, node.to)
          )
        }
      },
    })

    return Decoration.set(decorations)
  }
}

export const codeBlockExtension = ViewPlugin.fromClass(CodeBlockPlugin, {
  decorations: (v) => v.decorations,
})
```

**数学公式 Widget 实现思路**（`cm6/extensions/math-widget.ts`）：

```ts
// 行内公式 $...$
// 块级公式 $$...$$
// 使用 KaTeX 渲染
// 注意：Lezer markdown 默认不支持 $$ 语法，需要扩展 parser（Phase 5）
// 临时方案：用 StateField 扫描文本中的 $..$ 和 $$...$$ 模式

import katex from 'katex'
import { WidgetType } from '@codemirror/view'

class MathWidget extends WidgetType {
  constructor(
    private latex: string,
    private displayMode: boolean,
    private nodeFrom: number
  ) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement(this.displayMode ? 'div' : 'span')
    el.className = this.displayMode ? 'cm-math-block' : 'cm-math-inline'

    try {
      katex.render(this.latex, el, {
        displayMode: this.displayMode,
        throwOnError: false,
      })
    } catch {
      el.textContent = this.latex
    }

    el.addEventListener('click', () => {
      view.dispatch({ selection: { anchor: this.nodeFrom } })
      view.focus()
    })

    return el
  }

  eq(other: MathWidget) {
    return this.latex === other.latex && this.displayMode === other.displayMode
  }
}
```

**Mermaid Widget 实现思路**：

```ts
// 识别 ```mermaid 代码块
// 使用 mermaid.render() 渲染 SVG
// 渲染结果缓存，避免重复渲染
// 点击进入代码块编辑模式
```

**表格 Widget 实现思路**：

```ts
// 识别 Markdown 表格语法（|...|...|）
// 渲染为 HTML <table>
// 光标进入表格区域时显示源码
// 可考虑保留简单的行列操作（右键菜单添加/删除行列）
```

---

### Phase 4：交互功能

**目标**：搜索替换、BubbleMenu、任务列表、智能粘贴、图片拖放

**任务清单**：

- [ ] **搜索/替换**：基于 `@codemirror/search` 或自定义实现
- [ ] **BubbleMenu**：选中文本时显示格式化浮动菜单
- [ ] **任务列表 checkbox**：`- [ ]` 和 `- [x]` 的 checkbox 交互
- [ ] **智能粘贴**：检测粘贴内容是否为 Markdown，自动格式化
- [ ] **图片拖放**：拖放图片自动保存并插入
- [ ] **链接工具提示**：hover 链接显示 URL
- [ ] **快捷键系统**：复用现有快捷键定义（`DEFAULT_SHORTCUTS`）

**搜索/替换**（`cm6/extensions/search.ts`）：

```ts
// 方案 A（推荐）：基于 @codemirror/search
import { search, searchKeymap, openSearchPanel } from '@codemirror/search'

// 默认搜索面板可能样式不符合 MarkLight，可以：
// 1. 使用默认面板 + CSS 覆盖样式
// 2. 自定义面板（实现 search() 配置的 createPanel）

// 方案 B：复用现有 SearchBar.vue
// 在 CM6 中创建 StateField 存储搜索状态
// 用 Decoration.mark 高亮匹配
// SearchBar.vue 通过 emit 事件驱动搜索逻辑
```

**快捷键系统**（`cm6/extensions/shortcuts.ts`）：

```ts
import { keymap } from '@codemirror/view'
import { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'

// 复用现有快捷键定义
import { DEFAULT_SHORTCUTS, getShortcutDefinitions } from '../../core/plugins/shortcuts'
// 注意：上面这行需要把 ShortcutDef 和 DEFAULT_SHORTCUTS 抽取到独立文件
// 因为原文件依赖 prosemirror-*，迁移时需要拆分

// CM6 版本的快捷键命令
function toggleMarkdownMark(view: EditorView, prefix: string, suffix?: string): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const sfx = suffix ?? prefix

  if (from === to) {
    // 无选区：插入标记对并把光标放中间
    view.dispatch({
      changes: { from, insert: prefix + sfx },
      selection: { anchor: from + prefix.length },
    })
  } else {
    // 有选区：检查是否已有标记
    const selectedText = state.doc.sliceString(from, to)
    if (selectedText.startsWith(prefix) && selectedText.endsWith(sfx)) {
      // 移除标记
      const inner = selectedText.slice(prefix.length, -sfx.length)
      view.dispatch({
        changes: { from, to, insert: inner },
        selection: { anchor: from, head: from + inner.length },
      })
    } else {
      // 添加标记
      view.dispatch({
        changes: { from, to, insert: prefix + selectedText + sfx },
        selection: { anchor: from, head: from + prefix.length + selectedText.length + sfx.length },
      })
    }
  }
  return true
}

function setHeading(view: EditorView, level: number): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const text = line.text

  // 移除现有标题前缀
  const match = text.match(/^(#{1,6})\s/)
  const cleanText = match ? text.slice(match[0].length) : text

  // 设置新标题
  const newPrefix = level > 0 ? '#'.repeat(level) + ' ' : ''
  const newText = newPrefix + cleanText

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newText },
  })
  return true
}

function toggleList(view: EditorView, marker: string): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const text = line.text

  // 检查是否已是此类型列表
  const bulletMatch = text.match(/^(\s*)([-*+])\s/)
  const orderedMatch = text.match(/^(\s*)(\d+)\.\s/)
  const taskMatch = text.match(/^(\s*)- \[([ x])\]\s/)

  let newText: string
  if (marker === '- [ ] ') {
    if (taskMatch) {
      // 移除任务标记
      newText = text.slice(taskMatch[0].length)
    } else {
      const cleanText = bulletMatch ? text.slice(bulletMatch[0].length) :
                        orderedMatch ? text.slice(orderedMatch[0].length) : text
      newText = marker + cleanText
    }
  } else if (marker === '- ') {
    if (bulletMatch) {
      newText = text.slice(bulletMatch[0].length)
    } else {
      const cleanText = orderedMatch ? text.slice(orderedMatch[0].length) :
                        taskMatch ? text.slice(taskMatch[0].length) : text
      newText = marker + cleanText
    }
  } else {
    // 有序列表 "1. "
    if (orderedMatch) {
      newText = text.slice(orderedMatch[0].length)
    } else {
      const cleanText = bulletMatch ? text.slice(bulletMatch[0].length) :
                        taskMatch ? text.slice(taskMatch[0].length) : text
      newText = marker + cleanText
    }
  }

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newText },
  })
  return true
}

export function createShortcutsExtension(customShortcuts?: Record<string, string>) {
  const defs = getShortcutDefinitions(customShortcuts)

  const actionMap: Record<string, (view: EditorView) => boolean> = {
    bold: (v) => toggleMarkdownMark(v, '**'),
    italic: (v) => toggleMarkdownMark(v, '*'),
    strikethrough: (v) => toggleMarkdownMark(v, '~~'),
    highlight: (v) => toggleMarkdownMark(v, '=='),
    code: (v) => toggleMarkdownMark(v, '`'),
    heading1: (v) => setHeading(v, 1),
    heading2: (v) => setHeading(v, 2),
    heading3: (v) => setHeading(v, 3),
    heading4: (v) => setHeading(v, 4),
    heading5: (v) => setHeading(v, 5),
    heading6: (v) => setHeading(v, 6),
    paragraph: (v) => setHeading(v, 0),
    bulletList: (v) => toggleList(v, '- '),
    orderedList: (v) => toggleList(v, '1. '),
    taskList: (v) => toggleList(v, '- [ ] '),
    codeBlock: (v) => {
      const { state } = v
      const line = state.doc.lineAt(state.selection.main.head)
      v.dispatch({
        changes: { from: line.from, to: line.to, insert: '```\n' + line.text + '\n```' },
      })
      return true
    },
    blockquote: (v) => {
      const { state } = v
      const line = state.doc.lineAt(state.selection.main.head)
      const text = line.text
      const newText = text.startsWith('> ') ? text.slice(2) : '> ' + text
      v.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
      })
      return true
    },
    undo: (v) => undo(v),
    redo: (v) => redo(v),
  }

  // 构建 keymap
  const bindings: { key: string; run: (v: EditorView) => boolean }[] = []
  for (const def of defs) {
    const action = actionMap[def.id]
    if (action) {
      bindings.push({ key: def.key, run: action })
    }
  }

  return keymap.of(bindings)
}
```

**BubbleMenu 实现思路**：

```ts
// 1. 创建 ViewPlugin 监听选区变化
// 2. 选区非空时，计算选区位置 (view.coordsAtPos)
// 3. 通过回调通知 Vue 组件显示/隐藏 + 位置更新
// 4. 复用现有 BubbleMenu.vue 的 UI
// 5. 菜单操作通过 toggleMarkdownMark 等函数执行
```

**任务列表**（`cm6/extensions/task-list.ts`）：

```ts
// 1. 扫描文档中的 "- [ ] " 和 "- [x] " 模式
// 2. 在 checkbox 位置插入 Decoration.widget（CheckboxWidget）
// 3. CheckboxWidget.toDOM 创建 <input type="checkbox">
// 4. checkbox 点击事件：修改文档中的 [ ] ↔ [x]
```

---

### Phase 5：扩展语法支持

**目标**：支持 MarkLight 的扩展 Markdown 语法

**任务清单**：

- [ ] 扩展 Lezer Markdown parser 支持以下语法
- [ ] 任务列表 `- [ ]` / `- [x]`（Lezer 默认不支持）
- [ ] 脚注 `[^1]`
- [ ] 定义列表
- [ ] 上标 `^text^` / 下标 `~text~`
- [ ] 高亮 `==text==`
- [ ] 删除线 `~~text~~`（GFM 扩展，`@codemirror/lang-markdown` 内置）
- [ ] 缩写

**扩展 Lezer parser 示例**（`cm6/markdown-extensions.ts`）：

```ts
import { MarkdownConfig } from '@lezer/markdown'

// 删除线扩展（GFM 内置，无需自定义）
// import { GFM } from '@lezer/markdown'

// 高亮扩展 ==text==
export const HighlightExtension: MarkdownConfig = {
  defineNodes: ['Highlight', 'HighlightMark'],
  parseInline: [
    {
      name: 'Highlight',
      parse(cx, next, pos) {
        if (next !== 61 /* = */ || cx.char(pos + 1) !== 61) return -1
        const start = pos
        // 查找结束标记 ==
        let end = pos + 2
        while (end < cx.end) {
          if (cx.char(end) === 61 && cx.char(end + 1) === 61) {
            // 找到匹配的 ==
            return cx.addElement(
              cx.elt('Highlight', start, end + 2, [
                cx.elt('HighlightMark', start, start + 2),
                cx.elt('HighlightMark', end, end + 2),
              ])
            )
          }
          end++
        }
        return -1
      },
    },
  ],
}

// 上标 ^text^
export const SuperscriptExtension: MarkdownConfig = {
  defineNodes: ['Superscript', 'SuperscriptMark'],
  parseInline: [
    {
      name: 'Superscript',
      parse(cx, next, pos) {
        if (next !== 94 /* ^ */) return -1
        let end = pos + 1
        while (end < cx.end && cx.char(end) !== 94) end++
        if (end >= cx.end || end === pos + 1) return -1
        return cx.addElement(
          cx.elt('Superscript', pos, end + 1, [
            cx.elt('SuperscriptMark', pos, pos + 1),
            cx.elt('SuperscriptMark', end, end + 1),
          ])
        )
      },
    },
  ],
}

// 下标 ~text~（注意避免与删除线 ~~ 冲突）
export const SubscriptExtension: MarkdownConfig = {
  defineNodes: ['Subscript', 'SubscriptMark'],
  parseInline: [
    {
      name: 'Subscript',
      parse(cx, next, pos) {
        if (next !== 126 /* ~ */ || cx.char(pos + 1) === 126) return -1 // 排除 ~~
        let end = pos + 1
        while (end < cx.end && !(cx.char(end) === 126 && cx.char(end + 1) !== 126)) end++
        if (end >= cx.end || end === pos + 1) return -1
        return cx.addElement(
          cx.elt('Subscript', pos, end + 1, [
            cx.elt('SubscriptMark', pos, pos + 1),
            cx.elt('SubscriptMark', end, end + 1),
          ])
        )
      },
    },
  ],
}

// 数学公式 $...$ 和 $$...$$
export const MathExtension: MarkdownConfig = {
  defineNodes: ['InlineMath', 'BlockMath', 'MathMark'],
  parseInline: [
    {
      name: 'Math',
      parse(cx, next, pos) {
        if (next !== 36 /* $ */) return -1

        // 块级公式 $$...$$
        if (cx.char(pos + 1) === 36) {
          let end = pos + 2
          while (end < cx.end - 1) {
            if (cx.char(end) === 36 && cx.char(end + 1) === 36) {
              return cx.addElement(
                cx.elt('BlockMath', pos, end + 2, [
                  cx.elt('MathMark', pos, pos + 2),
                  cx.elt('MathMark', end, end + 2),
                ])
              )
            }
            end++
          }
          return -1
        }

        // 行内公式 $...$
        let end = pos + 1
        while (end < cx.end) {
          if (cx.char(end) === 36) {
            return cx.addElement(
              cx.elt('InlineMath', pos, end + 1, [
                cx.elt('MathMark', pos, pos + 1),
                cx.elt('MathMark', end, end + 1),
              ])
            )
          }
          end++
        }
        return -1
      },
    },
  ],
}
```

**在编辑器中使用扩展**：

```ts
import { markdown } from '@codemirror/lang-markdown'
import { HighlightExtension, MathExtension, SuperscriptExtension, SubscriptExtension } from './markdown-extensions'

// 创建 EditorState 时
markdown({
  extensions: [
    HighlightExtension,
    MathExtension,
    SuperscriptExtension,
    SubscriptExtension,
    // GFM 扩展（删除线、表格等）
    // GFM  ← 从 @lezer/markdown 导入
  ],
})
```

---

### Phase 6：集成与切换

**目标**：全面测试、去除旧代码、正式切换

**任务清单**：

- [ ] **导出功能适配**：
  - Markdown 导出：`view.state.doc.toString()`（零成本）
  - HTML 导出：Markdown 文本 → `markdown-it` 渲染（复用现有 markdown-it 配置）
- [ ] **统计信息**：字数、字符数、光标位置（已在 Phase 1 实现）
- [ ] **大纲提取**：扫描标题行生成大纲（已在 Phase 1 实现）
- [ ] **状态栏集成**：更新 `emit('update', ...)` 数据格式
- [ ] **A/B 测试**：两个引擎并行运行，对比所有功能
- [ ] **移除旧代码**：
  - 删除 `src/components/Editor/core/` 整个目录
  - 删除 `src/components/Editor/MarkdownEditor.vue`
  - 移除 `package.json` 中的 prosemirror-* 依赖
  - 更新导入路径
- [ ] **设置面板**：移除 `editorEngine` 开关（不再需要）

---

## 6. 各模块详细实现指引

### 6.1 快捷键系统迁移

**现有实现**：`src/components/Editor/core/plugins/shortcuts.ts`

**迁移策略**：
1. 将 `ShortcutDef`、`DEFAULT_SHORTCUTS`、`getShortcutDefinitions`、`formatKeyForDisplay` 等纯数据/工具函数抽取到 `src/utils/shortcuts.ts`（与 ProseMirror 无关的部分）
2. 在 `cm6/extensions/shortcuts.ts` 中引用这些定义，映射为 CM6 的 keymap
3. 现有快捷键完全保持兼容：`Mod-b`（加粗）、`Mod-i`（斜体）等

**关键差异**：
- ProseMirror 使用 `toggleMark(schema.marks.strong)` → CM6 使用 `toggleMarkdownMark(view, '**')`
- ProseMirror 使用 `setBlockType(schema.nodes.heading)` → CM6 使用 `setHeading(view, level)`
- ProseMirror 使用 `wrapInList(schema.nodes.bullet_list)` → CM6 使用 `toggleList(view, '- ')`

### 6.2 搜索替换迁移

**现有实现**：`src/components/Editor/core/plugins/search.ts` + `SearchBar.vue`

**迁移策略**：
1. `SearchBar.vue` 可完全复用（纯 UI 组件，不依赖 ProseMirror）
2. 搜索逻辑用 CM6 的 `@codemirror/search` 或自定义 StateField
3. 高亮匹配用 `Decoration.mark({ class: 'search-match' })`

### 6.3 BubbleMenu 迁移

**现有实现**：`src/components/Editor/core/plugins/bubble-menu.ts` + `views/BubbleMenu.vue`

**迁移策略**：
1. `BubbleMenu.vue` 可复用（纯 UI 组件）
2. CM6 中通过 `ViewPlugin` 监听选区变化
3. 使用 `view.coordsAtPos(from)` 计算浮动菜单位置
4. 菜单操作改为调用 CM6 的文本操作函数

### 6.4 NodeView → Widget 迁移对照表

| ProseMirror NodeView | CM6 Widget | 复用程度 |
|---|---|---|
| `CodeBlockView.vue` | `CodeBlockWidget` | UI 逻辑可复用，需改为纯 DOM |
| `MathView.vue` | `MathWidget` | KaTeX 渲染逻辑可复用 |
| `ImageView.vue` | `ImageWidget` | 图片预览逻辑可复用 |
| `MermaidView.vue` | `MermaidWidget` | mermaid.render 逻辑可复用 |
| `TableToolbar.vue` | `TableWidget` | 需要重新设计（CM6 表格是纯文本） |

**注意**：CM6 的 `WidgetType.toDOM()` 返回纯 DOM 元素，不能直接用 Vue 组件。有两种方案：
1. **纯 DOM 实现**（推荐）：直接用 `document.createElement` 构建
2. **Vue 挂载**：`createApp(Component).mount(container)` — 更复杂但可复用 Vue 组件

### 6.5 图片处理迁移

**现有实现**：`src/components/Editor/core/plugins/image-handle.ts`

**迁移策略**：
1. 拖放事件：使用 CM6 的 `EditorView.domEventHandlers({ drop: ... })`
2. 图片保存逻辑复用 `saveAndInsertImage`（需适配参数）
3. 插入图片：`view.dispatch({ changes: { from: pos, insert: '![alt](path)' } })`
4. Tauri 原生拖拽兜底逻辑保持不变

---

## 7. 文件清单与依赖变更

### 7.1 文件变更清单

#### 新增文件

| 文件路径 | 说明 | Phase |
|---|---|---|
| `src/components/Editor/MarkdownEditorCM6.vue` | 新编辑器主组件 | 0 |
| `src/components/Editor/cm6/extensions/live-preview.ts` | 核心 Live Preview 扩展 | 2 |
| `src/components/Editor/cm6/extensions/code-block-widget.ts` | 代码块 Widget | 3 |
| `src/components/Editor/cm6/extensions/math-widget.ts` | 数学公式 Widget | 3 |
| `src/components/Editor/cm6/extensions/image-widget.ts` | 图片 Widget | 3 |
| `src/components/Editor/cm6/extensions/mermaid-widget.ts` | Mermaid 图表 Widget | 3 |
| `src/components/Editor/cm6/extensions/table-widget.ts` | 表格 Widget | 3 |
| `src/components/Editor/cm6/extensions/task-list.ts` | 任务列表扩展 | 4 |
| `src/components/Editor/cm6/extensions/shortcuts.ts` | 快捷键扩展 | 1 |
| `src/components/Editor/cm6/extensions/search.ts` | 搜索替换扩展 | 4 |
| `src/components/Editor/cm6/extensions/bubble-menu.ts` | 浮动菜单扩展 | 4 |
| `src/components/Editor/cm6/extensions/smart-paste.ts` | 智能粘贴扩展 | 4 |
| `src/components/Editor/cm6/extensions/image-drop.ts` | 图片拖放扩展 | 4 |
| `src/components/Editor/cm6/theme.ts` | 编辑器主题样式 | 1 |
| `src/components/Editor/cm6/markdown-extensions.ts` | Lezer parser 扩展 | 5 |
| `src/utils/shortcuts.ts` | 快捷键定义（从 core/ 抽取） | 0 |

#### 可直接复用（无需修改）

| 文件路径 | 说明 |
|---|---|
| `src/composables/useFileOperations.ts` | 文件打开/保存/自动保存 |
| `src/composables/useFileTree.ts` | 文件树管理 |
| `src/composables/useExportActions.ts` | 导出操作 |
| `src/composables/useImagePreview.ts` | 图片预览 |
| `src/composables/useWindowEvents.ts` | 窗口事件 |
| `src/composables/useMenuEvents.ts` | 菜单事件 |
| `src/stores/file.ts` | 文件状态管理 |
| `src/stores/settings.ts` | 设置管理（需小改：添加 editorEngine 字段） |
| `src/components/Layout/*` | 所有布局组件 |
| `src-tauri/*` | 整个 Rust 后端 |

#### 可复用 UI（需适配集成层）

| 文件路径 | 说明 | 适配工作 |
|---|---|---|
| `src/components/Editor/views/BubbleMenu.vue` | 浮动菜单 UI | 改 emit 事件处理 |
| `src/components/Editor/SearchBar.vue` | 搜索栏 UI | 改搜索后端逻辑 |
| `src/components/Editor/ShortcutsModal.vue` | 快捷键面板 | 无需改动 |

#### 最终删除（Phase 6 完成后）

| 文件/目录 | 说明 |
|---|---|
| `src/components/Editor/MarkdownEditor.vue` | 旧编辑器主组件 |
| `src/components/Editor/core/` | 整个 ProseMirror 核心目录 |
| `src/components/Editor/views/CodeBlockView.vue` | PM 代码块 NodeView |
| `src/components/Editor/views/MathView.vue` | PM 数学公式 NodeView |
| `src/components/Editor/views/MermaidView.vue` | PM Mermaid NodeView |
| `src/components/Editor/views/ImageView.vue` | PM 图片 NodeView |
| `src/components/Editor/views/TableToolbar.vue` | PM 表格工具栏 |

### 7.2 依赖变更

#### 新增依赖

```bash
pnpm add @codemirror/view @codemirror/state @codemirror/language \
         @codemirror/lang-markdown @codemirror/commands @codemirror/search \
         @codemirror/autocomplete @lezer/markdown @lezer/highlight
```

可选（如果使用现有 Live Preview 库）：
```bash
pnpm add codemirror-live-markdown
```

#### 最终移除（Phase 6 完成后）

```bash
pnpm remove prosemirror-model prosemirror-view prosemirror-state \
            prosemirror-commands prosemirror-keymap prosemirror-history \
            prosemirror-inputrules prosemirror-schema-basic \
            prosemirror-schema-list prosemirror-tables \
            prosemirror-transform prosemirror-markdown
pnpm remove -D @types/prosemirror-tables
```

#### 保留

```
markdown-it (+ 所有插件) — 用于 HTML 导出
highlight.js / lowlight   — 代码语法高亮
katex                     — 数学公式渲染
mermaid                   — 图表渲染
lodash-es                 — 工具函数
```

---

## 8. 可复用资源清单

### 8.1 可直接复用的逻辑

| 现有代码 | 位置 | CM6 中如何复用 |
|---|---|---|
| 快捷键定义 `DEFAULT_SHORTCUTS` | `core/plugins/shortcuts.ts` | 抽到 `utils/shortcuts.ts`，CM6 扩展引用 |
| 快捷键冲突检测 | `core/plugins/shortcuts.ts` | 直接复用 |
| 快捷键格式化显示 | `core/plugins/shortcuts.ts` | 直接复用 |
| 文件操作 | `composables/useFileOperations.ts` | 直接复用，`setContent` 改为 `doc.toString()` |
| 文件树 | `composables/useFileTree.ts` | 完全不变 |
| 导出操作 | `composables/useExportActions.ts` | HTML 导出仍用 markdown-it |
| 文件状态 | `stores/file.ts` | 完全不变 |
| 设置管理 | `stores/settings.ts` | 添加 `editorEngine` 字段 |
| CSS 变量体系 | `assets/styles/main.css` | 完全不变，CM6 theme 引用 CSS 变量 |
| BubbleMenu UI | `views/BubbleMenu.vue` | 复用 UI，改事件绑定 |
| SearchBar UI | `SearchBar.vue` | 复用 UI，改搜索后端 |
| 代码高亮 | highlight.js 配置 | Widget 中直接使用 |
| KaTeX 渲染 | MathView.vue 中的逻辑 | Widget 中直接使用 |
| Mermaid 渲染 | MermaidView.vue 中的逻辑 | Widget 中直接使用 |

### 8.2 现有快捷键完整列表（需全部迁移）

| ID | 默认键 | 功能 | CM6 实现函数 |
|---|---|---|---|
| `bold` | `Mod-b` | 粗体 | `toggleMarkdownMark(v, '**')` |
| `italic` | `Mod-i` | 斜体 | `toggleMarkdownMark(v, '*')` |
| `strikethrough` | `Mod-Shift-x` | 删除线 | `toggleMarkdownMark(v, '~~')` |
| `highlight` | `Mod-Shift-h` | 高亮 | `toggleMarkdownMark(v, '==')` |
| `code` | `` Mod-` `` | 行内代码 | `` toggleMarkdownMark(v, '`') `` |
| `heading1`-`heading6` | `Mod-1` ~ `Mod-6` | 标题 | `setHeading(v, 1~6)` |
| `paragraph` | `Mod-0` | 普通段落 | `setHeading(v, 0)` |
| `orderedList` | `Mod-Shift-7` | 有序列表 | `toggleList(v, '1. ')` |
| `bulletList` | `Mod-Shift-8` | 无序列表 | `toggleList(v, '- ')` |
| `taskList` | `Mod-Shift-9` | 任务列表 | `toggleList(v, '- [ ] ')` |
| `codeBlock` | `Mod-Shift-c` | 代码块 | 插入 ` ``` ` 围栏 |
| `blockquote` | `Mod-Shift-q` | 引用块 | 行首切换 `> ` |
| `undo` | `Mod-z` | 撤销 | `undo(v)` |
| `redo` | `Mod-Shift-z` | 重做 | `redo(v)` |

---

## 9. 验证方案

### 9.1 功能验证清单

#### 基础编辑
- [ ] 输入文本、换行、删除
- [ ] undo/redo（Mod-Z / Mod-Shift-Z）
- [ ] 全选（Mod-A）
- [ ] 复制/粘贴

#### Live Preview
- [ ] 光标不在标题行 → 显示大字号标题，无 `##` 前缀
- [ ] 光标进入标题行 → `## 标题文本` 完整显示，`##` 为灰色
- [ ] 修改 `##` 为 `###` → 标题级别实时变化
- [ ] 删除所有 `#` → 变为普通段落
- [ ] 光标离开 → 回到渲染视图
- [ ] 跨行选区：从标题行选到普通行，两行都显示源码

#### 行内格式
- [ ] `**加粗**`：光标不在行 → 加粗样式，无 `**`；光标在行 → `**` 灰色可见
- [ ] `*斜体*`：同上
- [ ] `~~删除线~~`：同上
- [ ] `` `代码` ``：同上
- [ ] `==高亮==`：同上
- [ ] 嵌套格式：`**加粗中的*斜体*文本**`

#### 复杂块
- [ ] 代码块：语法高亮渲染，点击进入源码编辑
- [ ] 数学公式（行内 `$...$`）：KaTeX 渲染
- [ ] 数学公式（块级 `$$...$$`）：KaTeX 渲染
- [ ] 图片：预览显示
- [ ] Mermaid 图表：SVG 渲染
- [ ] 表格：HTML 表格渲染

#### 列表
- [ ] 无序列表 `- item`
- [ ] 有序列表 `1. item`
- [ ] 任务列表 `- [ ] item` / `- [x] item`
- [ ] checkbox 可点击切换

#### 交互
- [ ] 搜索（Mod-F）：高亮所有匹配
- [ ] 替换：单个替换 + 全部替换
- [ ] BubbleMenu：选中文本显示格式化菜单
- [ ] 快捷键：所有 18 个快捷键正常工作
- [ ] 智能粘贴：粘贴 Markdown 文本保持格式
- [ ] 图片拖放：拖入图片自动保存并插入

#### 文件操作
- [ ] 打开文件（内容正确加载）
- [ ] 保存文件（内容与编辑器一致）
- [ ] 自动保存（周期触发）
- [ ] 冲突检测（外部修改提示）

#### 导出
- [ ] Markdown 导出（`doc.toString()` 内容正确）
- [ ] HTML 导出（markdown-it 渲染正确）

### 9.2 性能验证

| 测试项 | 目标 | 测试方法 |
|---|---|---|
| 大文件打开 | < 500ms | 打开 10000 行 Markdown 文件 |
| 编辑延迟 | < 16ms (60fps) | 大文件中连续输入 |
| 行切换 | 无可感知延迟 | 光标在行间移动 |
| 滚动流畅度 | 60fps | 大文件快速滚动 |
| Decoration 闪烁 | 无闪烁 | 快速在行间跳转 |

### 9.3 回归验证

- [ ] 与旧编辑器做 A/B 对比，确保所有功能覆盖
- [ ] 同一个 Markdown 文件在两个引擎中打开 → 保存 → 再打开，内容一致
- [ ] 所有快捷键行为一致
- [ ] 搜索替换结果一致

---

## 10. 风险与注意事项

### 10.1 技术风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| Lezer parser 不支持某些扩展语法 | 部分扩展格式无法实现 Live Preview | 自定义 MarkdownConfig 扩展 parser |
| CM6 Widget 不支持 Vue 组件 | 现有 Vue NodeView 无法直接复用 | 改为纯 DOM 实现，或用 createApp 桥接 |
| 表格编辑体验退化 | PM 的 prosemirror-tables 提供了强大的表格编辑 | 简化为源码编辑 + 渲染预览 |
| 跨行元素的 Live Preview | 如跨多行的引用块、列表 | 以「行块」为单位判断光标是否在内 |
| 光标位置计算差异 | CM6 的坐标与 PM 不同 | 使用 `view.coordsAtPos()` |

### 10.2 开发注意事项

1. **并行开发**：在 Phase 0-5 期间，旧编辑器保持完全可用。通过设置开关切换。
2. **增量验证**：每完成一个 Phase，立即进行该阶段的功能验证。
3. **Git 分支**：建议在 `feature/cm6-migration` 分支上开发，避免影响主分支。
4. **代码审查**：每个 Phase 完成后进行代码审查再合并。
5. **文档同步**：随着开发推进，及时更新本文档的完成状态。

### 10.3 关键参考资源

- [CodeMirror 6 官方文档](https://codemirror.net/docs/)
- [Lezer Markdown Parser](https://github.com/lezer-parser/markdown)
- [codemirror-live-markdown](https://github.com/nickmartinezreiner/codemirror-live-markdown)（最推荐的参考实现）
- [Obsidian Live Preview 架构分析](https://forum.obsidian.md/t/live-preview-under-the-hood/38950)
- [CM6 Extension 开发指南](https://codemirror.net/docs/guide/)
- [CM6 Decoration 示例](https://codemirror.net/examples/decoration/)

---

## 附录：Phase 进度跟踪

| Phase | 内容 | 状态 | 负责人 | 备注 |
|---|---|---|---|---|
| Phase 0 | 准备工作 | ⬜ 未开始 | | |
| Phase 1 | 基础编辑器 | ⬜ 未开始 | | |
| Phase 2 | Live Preview 核心 | ⬜ 未开始 | | 最关键阶段 |
| Phase 3 | 复杂块 Widget | ⬜ 未开始 | | |
| Phase 4 | 交互功能 | ⬜ 未开始 | | |
| Phase 5 | 扩展语法支持 | ⬜ 未开始 | | |
| Phase 6 | 集成与切换 | ⬜ 未开始 | | |
