<p align="center">
  <img src="./public/icon.png" width="160" alt="MarkLight Logo" />
</p>

<h1 align="center">MarkLight</h1>

<p align="center">
  <strong>A local-first Markdown editor built with Tauri 2, a Rust domain core, and TipTap.</strong>
</p>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <a href="./README.ja-JP.md">日本語</a>
  ·
  <a href="./README.ko-KR.md">한국어</a>
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

## Highlights

- WYSIWYG editing: powered by TipTap / ProseMirror, with editable rendered blocks for code, tables, math, Mermaid diagrams, callouts, and more.
- Local-first workflow: documents, images, and workspaces stay on your machine. Dropped images are saved into an `assets/` folder next to the current document.
- Desktop-native experience: multi-window editing, persisted window state, native menus, and system printing.
- Structured workspaces: Rust handles directory filtering, watcher aggregation, external change events, and save-conflict detection.
- WeChat and HTML export: the frontend renders export-ready content while the native layer handles printing and file writes.

## Architecture

MarkLight uses three clear layers:

- Vue 3 + Pinia + TipTap: UI, editor interactions, and command dispatch.
- Tauri 2: plugins, permission boundaries, and the command/event bridge.
- Rust domain core: document, workspace, window runtime, and watcher consistency.

Project constraints:

- Frontend business logic does not call `invoke`, `listen`, or `emit` directly.
- Public Rust commands return structured DTOs and `AppError`.
- Common desktop capabilities should use official Tauri plugins first.

More documentation:

- [Documentation index](./docs/README.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Engineering standards](./docs/ENGINEERING_STANDARDS.md)
- [Roadmap](./docs/ROADMAP.md)
- [Changelog](./docs/CHANGELOG.md)

## Tech Stack

- Desktop framework: Tauri 2
- Native core: Rust
- Frontend: Vue 3 + TypeScript + Pinia + Vite
- Editor: TipTap / ProseMirror
- Markdown: markdown-it + custom parser / serializer
- Styling: Tailwind CSS
- Native plugins: store / window-state / dialog / opener / cli

## Development

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

## Current Architecture Notes

- Save-conflict detection is centralized in Rust `save_document`.
- Workspace watcher events are normalized as `workspace-changed`.
- Startup open, system open, and multi-window pending open requests share the `app-open-paths` payload model.
- `App.vue` is now a composition surface. Document, workspace, and window lifecycles live in dedicated session composables.

## Contributing

- Issues and pull requests are welcome on GitHub.
- Before changing architecture or ownership boundaries, read `docs/ARCHITECTURE.md` and `docs/ENGINEERING_STANDARDS.md`.
- When adding a capability, first justify why it cannot be handled by existing plugins or domain modules.

## License

MarkLight is open source under the [Apache License 2.0](LICENSE).
