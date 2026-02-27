# MarkLight 技术栈选型文档

本项目旨在通过自研核心编辑器内核，实现一个极致轻量、高度可控、且具备"所见即所得"体验的 Markdown 编辑器。

## 1. 桌面框架：Tauri 2.0

### 为什么选择 Tauri？

| 对比项 | Tauri | Electron |
|--------|-------|----------|
| 安装包大小 | ~10MB | ~150MB |
| 内存占用 | ~50MB | ~200MB |
| 后端语言 | Rust | Node.js |
| 安全性 | 更高 | 一般 |

### 核心能力
- **文件系统**：`@tauri-apps/plugin-fs`
- **系统对话框**：`@tauri-apps/plugin-dialog`
- **原生菜单**：通过 `menu-event` 事件通信
- **跨平台**：macOS / Windows / Linux

## 2. 编辑器内核：ProseMirror

### 为什么选择 ProseMirror？

- **Headless（无头）**：不提供任何默认 UI，所有工具栏、菜单完全由 Vue 3 自由定制
- **Schema-driven**：文档结构通过 Schema 定义，天然契合 Markdown 的树状结构
- **Transaction 机制**：所有修改通过事务进行，方便实现撤销/重做和协同编辑
- **NodeViews**：允许使用 Vue 组件渲染特定节点（代码块、数学公式等）

### 核心模块

| 模块 | 用途 |
|------|------|
| `prosemirror-state` | 编辑器状态管理 |
| `prosemirror-view` | 视图渲染 |
| `prosemirror-model` | 文档模型（Schema, Node） |
| `prosemirror-history` | 撤销/重做 |
| `prosemirror-keymap` | 快捷键绑定 |
| `prosemirror-inputrules` | 输入规则转换 |
| `prosemirror-commands` | 编辑命令 |
| `prosemirror-tables` | 表格支持 |
| `prosemirror-markdown` | Markdown 解析/序列化 |

## 3. 前端框架：Vue 3 + Tailwind CSS

### Vue 3
- **Composition API**：逻辑复用更灵活
- **Script Setup**：代码更简洁
- **响应式系统**：与 ProseMirror 状态同步

### Tailwind CSS 4.0
- 原子化 CSS，开发效率高
- 与 ProseMirror 样式无冲突
- 支持 JIT 模式，打包体积小

## 4. 辅助引擎

### Markdown 解析
- **prosemirror-markdown**：MD ↔ ProseMirror Node 互转
- **markdown-it**：备用解析器（部分场景）

### 代码高亮
- **lowlight**：基于 Highlight.js 的 AST 高亮
- **highlight.js**：支持 190+ 语言

### 数学公式
- **KaTeX**：比 MathJax 快 3-5 倍
- 支持 `$...$` 行内公式和 `$$...$$` 块级公式

## 5. 状态管理：Pinia

```typescript
// stores/file.ts
export const useFileStore = defineStore('file', () => {
  const currentFile = ref<FileState>({
    path: null,
    content: '',
    isDirty: false,
  });
  
  // 方法...
});
```

## 6. 工具库

| 库 | 用途 |
|---|------|
| `lodash-es` | 防抖、节流等工具函数 |
| `@tauri-apps/plugin-os` | 系统信息获取 |

## 7. 开发工具

| 工具 | 用途 |
|------|------|
| **Vite** | 构建工具 |
| **TypeScript** | 类型安全 |
| **vue-tsc** | Vue 类型检查 |

## 8. 依赖清单

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.10.1",
    "@tauri-apps/plugin-dialog": "^2.6.0",
    "@tauri-apps/plugin-fs": "^2.4.5",
    "@tauri-apps/plugin-opener": "^2.5.3",
    "highlight.js": "^11.11.1",
    "katex": "^0.16.28",
    "lodash-es": "^4.17.23",
    "lowlight": "^3.3.0",
    "markdown-it": "^14.1.1",
    "pinia": "^3.0.4",
    "prosemirror-commands": "^1.7.1",
    "prosemirror-history": "^1.5.0",
    "prosemirror-inputrules": "^1.5.1",
    "prosemirror-keymap": "^1.2.3",
    "prosemirror-markdown": "^1.13.4",
    "prosemirror-model": "^1.25.4",
    "prosemirror-schema-basic": "^1.2.4",
    "prosemirror-schema-list": "^1.5.1",
    "prosemirror-state": "^1.4.4",
    "prosemirror-tables": "^1.8.5",
    "prosemirror-view": "^1.41.6",
    "vue": "^3.5.28"
  }
}
```