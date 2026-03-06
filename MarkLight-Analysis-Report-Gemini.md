# MarkLight 项目阶段性分析与总结报告
**分析人：** Gemini (CLI Agent)
**日期：** 2026-02-23

---

## 1. 已完成工作总结 (Work Completed)

我们针对 **MarkLight** 在跨平台开发（特别是 macOS）中遇到的核心交互问题进行了深度修复。

### 1.1 系统权限与窗口集成
*   **修复内容**：解决了 Tauri v2 限制前端修改窗口标题的权限问题。
*   **实现功能**：窗口标题现在能实时反映当前打开的文件名，并根据 `isDirty` 状态显示未保存标记 `●`。
*   **涉及文件**：
    *   `src-tauri/capabilities/default.json` (权限配置)
    *   `src/App.vue` (标题同步逻辑)

### 1.2 原生菜单与剪贴板增强
*   **修复内容**：通过 Rust 后端配置原生菜单，解决了 macOS 下快捷键（Cmd+C/V/Z/A）失效的问题。
*   **汉化处理**：将原生编辑菜单完全汉化，并精简为「撤销、重做、剪切、复制、粘贴、全选」。
*   **复制优化**：实现了 `onCopy` 拦截器，确保从编辑器复制的内容始终是标准 Markdown 源码，而非破坏性的富文本片段。
*   **涉及文件**：
    *   `src-tauri/src/lib.rs` (Rust 菜单定义)
    *   `src/App.vue` (剪贴板事件监听与焦点控制)

### 1.3 编辑器底层通信优化
*   **修复内容**：打通了 Vue 组件层与 ProseMirror 核心层的通信。
*   **实现功能**：暴露了 `getEditorView` 接口，支持外部组件（如原生菜单事件）直接操作编辑器的历史记录和选区。
*   **涉及文件**：
    *   `src/components/Editor/MarkdownEditor.vue` (API 暴露)

---

## 2. 当前功能概况 (Current Feature Status)

| 功能模块 | 状态 | 备注 |
| :--- | :--- | :--- |
| **文件树浏览** | 🟢 正常 | 支持文件夹加载与文件切换。 |
| **实时预览编辑** | 🟢 正常 | 支持标题、列表、表格、代码块、公式、图表。 |
| **任务列表** | 🟢 正常 | 支持点击 Checkbox 交互勾选。 |
| **源码模式** | 🟢 正常 | 提供极简文本编辑环境。 |
| **系统原生菜单** | 🟢 正常 | 已汉化，支持标准快捷键。 |
| **微信格式导出** | 🟢 正常 | 支持 HTML 转换并自动复制。 |

---

## 3. 技术债务与待优化点 (Technical Debt)

### 3.1 Markdown 解析器鲁棒性 (高优先级)
*   **现象**：粘贴或打开包含原生 HTML 标签（如 `<i class="icon">`）的文档时，解析器会因 `html_inline` Token 未定义而报错崩溃。
*   **涉及文件**：
    *   `src/components/Editor/core/markdown.ts`
    *   `src/components/Editor/core/config/token-specs.ts`
*   **债务说明**：需要实现一个安全的降级机制，将无法识别的 HTML 标签转义为普通文本，而不是直接抛错。

### 3.2 文件树实时监听 (中优先级)
*   **现象**：侧边栏文件树为静态加载，外部文件变动不会自动刷新。
*   **涉及文件**：
    *   `src/App.vue`
    *   `src-tauri/src/lib.rs`
*   **债务说明**：缺乏文件系统监听器（Watcher），在大规模文件管理时体验受限。

### 3.3 大纲提取性能 (低优先级)
*   **现象**：每次输入都会全量遍历文档以生成大纲。
*   **涉及文件**：
    *   `src/components/Editor/MarkdownEditor.vue`
*   **债务说明**：超长文档（>5万字）可能会有输入延迟，建议改为增量更新或异步 Worker。

---

## 4. 涉及的核心代码文件清单

1.  **权限定义**：`src-tauri/capabilities/default.json`
2.  **后端入口/菜单**：`src-tauri/src/lib.rs`
3.  **主应用容器**：`src/App.vue`
4.  **编辑器核心组件**：`src/components/Editor/MarkdownEditor.vue`
5.  **Markdown 处理逻辑**：`src/components/Editor/core/markdown.ts`
6.  **解析标记映射**：`src/components/Editor/core/config/token-specs.ts`

---
*报告生成：Gemini CLI Agent - 2026/02/23*
