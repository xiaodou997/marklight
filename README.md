# MarkLight

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![Vue](https://img.shields.io/badge/Vue-3.x-green.svg)](https://vuejs.org/)

> 一款基于 Tauri 2.0 和 ProseMirror 的自研内核 Markdown 编辑器。灵感来源于 Typora，追求极致的性能与完全的自主可控。

## ✨ 核心特性

### 编辑体验
- **所见即所得 (WYSIWYG)**：摒弃分栏预览，输入即渲染
- **源码模式**：一键切换源码视图，满足不同编辑习惯
- **实时大纲**：侧边栏展示文档结构，点击快速跳转
- **设置界面**：主题、字体、自动保存等个性化配置

### Markdown 支持
- **自动转换**：`#` 标题、`>` 引用、``` 代码块
- **任务列表**：`- [ ]` 和 `- [x]` 可交互任务清单
- **数学公式**：KaTeX 渲染，支持行内 `$...$` 和块级 `$$...$$`
- **图片处理**：拖拽、粘贴上传，实时预览
- **表格系统**：工业级表格编辑，支持列宽调整
- **代码高亮**：Lowlight (Highlight.js) 语法高亮
- **Mermaid 图表**：支持流程图、时序图等

### 生产力工具
- **微信排版**：一键导出带行内样式的 HTML，完美适配公众号
- **状态栏**：实时显示字数、行列位置、阅读时间
- **原生菜单**：macOS 原生菜单栏支持

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.0 (Rust) |
| 编辑器内核 | ProseMirror |
| 解析引擎 | prosemirror-markdown |
| 前端框架 | Vue 3 (Composition API) |
| 样式方案 | Tailwind CSS 4.0 |
| 数学渲染 | KaTeX |
| 语法高亮 | Lowlight (Highlight.js) |
| 状态管理 | Pinia |

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Rust 1.70+
- pnpm

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# Web 端预览
pnpm dev

# 本地应用开发（推荐）
pnpm dev:tauri
```

### 构建发布

```bash
# 构建桌面应用
pnpm build:tauri
```

## 🎯 功能清单

### 已完成 ✅

- [x] ProseMirror 编辑器内核
- [x] Markdown 解析与序列化
- [x] 代码块语法高亮
- [x] 数学公式渲染 (KaTeX)
- [x] Mermaid 图表支持
- [x] 图片拖拽/粘贴
- [x] 表格编辑
- [x] 任务列表交互
- [x] 实时大纲
- [x] 源码模式切换
- [x] 微信排版导出
- [x] macOS 原生菜单
- [x] 设置界面

### 进行中 🚧

- [ ] 多窗口支持
- [ ] 自动保存
- [ ] 主题切换 (深色/浅色)
- [ ] PDF 导出
- [ ] 搜索替换

## 📁 项目结构

```
marklight/
├── src/
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── MarkdownEditor.vue    # 主编辑器组件
│   │   │   ├── Outline.vue           # 大纲视图
│   │   │   ├── Sidebar.vue           # 侧边栏
│   │   │   ├── core/
│   │   │   │   ├── markdown.ts       # MD 解析/序列化
│   │   │   │   ├── schema.ts         # 节点定义
│   │   │   │   ├── nodeViews/        # Vue NodeView 桥接
│   │   │   │   └── plugins/          # ProseMirror 插件
│   │   │   └── views/
│   │   │       ├── BubbleMenu.vue    # 气泡菜单 UI
│   │   │       ├── CodeBlockView.vue # 代码块组件
│   │   │       ├── ImageView.vue     # 图片组件
│   │   │       ├── MathView.vue      # 数学公式组件
│   │   │       └── MermaidView.vue   # 图表组件
│   │   ├── Layout/
│   │   │   └── StatusBar.vue         # 状态栏
│   │   ├── Toolbar/
│   │   │   └── EditorToolbar.vue     # 工具栏
│   │   └── Settings/
│   │       └── SettingsModal.vue     # 设置弹窗
│   ├── stores/
│   │   ├── file.ts                   # 文件状态管理
│   │   └── settings.ts               # 设置状态管理
│   ├── utils/
│   │   └── wechat-renderer.ts        # 微信排版导出
│   └── App.vue                       # 应用入口
├── src-tauri/                        # Rust 后端
│   ├── src/lib.rs                    # 文件读写命令
│   └── tauri.conf.json               # Tauri 配置
└── docs/                             # 文档
    ├── architecture.md               # 架构设计
    ├── tech-stack.md                 # 技术栈说明
    └── phase-1-roadmap.md            # 开发路线
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源协议。

这意味着你可以：
- ✅ 商业使用
- ✅ 修改
- ✅ 分发
- ✅ 私人使用

唯一要求是保留版权声明和许可证副本。

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [ProseMirror](https://prosemirror.net/) - 优秀的编辑器框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Typora](https://typora.io/) - 设计灵感来源

---

**MarkLight** - 记录思考，从轻开始。
