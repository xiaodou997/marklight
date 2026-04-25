<p align="center">
  <img src="./public/icon.png" width="160" alt="MarkLight Logo" />
</p>

<h1 align="center">墨光 (MarkLight)</h1>

<p align="center">
  <strong>一款基于 Tauri 2、Rust 领域内核与 TipTap 的本地优先 Markdown 编辑器</strong>
</p>

<p align="center">
  <a href="https://github.com/xiaodou997/marklight/releases">
    <img src="https://img.shields.io/github/v/release/xiaodou997/marklight?style=flat-square&color=blue" alt="Version" />
  </a>
  <a href="https://gitee.com/xiaodou997/marklight">
    <img src="https://img.shields.io/badge/Gitee-xiaodou997-red?style=flat-square&logo=gitee" alt="Gitee" />
  </a>
  <a href="https://github.com/xiaodou997/marklight/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-Apache--2.0-green?style=flat-square" alt="Apache-2.0" />
  </a>
</p>

## 核心特性

- 所见即所得编辑：基于 TipTap / ProseMirror，代码块、表格、数学公式、Mermaid、Callout 等都在渲染态编辑。
- 本地优先：文档、图片和工作区全部在本地管理，图片自动落到文档目录下的 `assets/`。
- 多窗口桌面体验：支持新窗口打开文档、窗口状态持久化、原生菜单和系统打印。
- 结构化工作区：Rust 负责目录过滤、watcher 聚合、外部变更事件和保存冲突检测。
- 微信与 HTML 导出：前端渲染导出内容，原生侧负责打印与文件写入。

## 技术架构

MarkLight 现在采用明确的三层边界：

- Vue 3 + Pinia + TipTap：负责 UI、编辑器体验和命令分发
- Tauri 2：负责插件、权限边界和命令/事件桥接
- Rust 领域内核：负责文档、工作区、窗口运行时和 watcher 一致性

约束如下：

- 前端业务层不直接调用 `invoke` / `listen` / `emit`
- Rust 对外命令全部返回结构化 DTO 和 `AppError`
- 通用桌面能力优先使用官方插件

更多说明见：

- [文档索引](./docs/README.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [工程标准](./docs/ENGINEERING_STANDARDS.md)
- [路线图](./docs/ROADMAP.md)
- [更新日志](./docs/CHANGELOG.md)

## 技术栈

- 桌面框架：Tauri 2
- 原生内核：Rust
- 前端：Vue 3 + TypeScript + Pinia + Vite
- 编辑器：TipTap / ProseMirror
- Markdown：markdown-it + 自定义 parser / serializer
- 样式：Tailwind CSS
- 原生插件：store / window-state / dialog / opener / cli

## 开发

```bash
bun install
bun run dev
bun run dev:tauri
bun run build
bun run build:tauri
bun run lint
bun run format
bunx vue-tsc --noEmit
bun run test
cargo check --manifest-path src-tauri/Cargo.toml
```

## 当前架构重点

- 文档保存冲突检测已经统一移到 Rust `save_document`
- 工作区 watcher 事件统一为 `workspace-changed`
- 启动打开、系统打开、多窗口待处理打开请求统一使用 `app-open-paths` payload 模型
- `App.vue` 只做组合面，文档/工作区/窗口生命周期已经分别下沉到 session composable

## 贡献

- Issue 和 PR 欢迎提交到 GitHub
- 架构或边界变更前，请先阅读 `docs/ARCHITECTURE.md` 和 `docs/ENGINEERING_STANDARDS.md`
- 新能力进入项目时，请优先证明为什么不能由现有插件或现有领域模块承担

## License

MarkLight 基于 [Apache License 2.0](LICENSE) 开源。
