# MarkLight Remediation Plan

更新时间：2026-06-11

本计划用于把当前代码库从“可运行”推进到边界清晰、可持续维护的状态。执行时必须保持小提交；每个阶段完成后都要通过：

```bash
bun run test
bun run lint
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
```

提交约束：

- 不丢弃用户已有改动。
- 不把全仓库格式化和架构重构混在同一个提交里。
- 每个提交只覆盖一个可解释的边界或行为变化。
- 变更 Tauri 边界、命令契约、事件模型或文档流时，同步补充测试或审计证据。

## 1. 当前安全修复保留与验证

状态：已完成。

完成标准：

- 保留进入整改前已有的安全修复。
- 单独提交，不与后续架构拆分混合。
- 全量验证通过。

审计证据：

- Rust 文档命令已经使用结构化 `AppError`。
- 图片资产预览通过 `authorize_image_asset` 校验文件类型并授权 canonical path。
- 文档保存带 last-modified 冲突检测。

## 2. Tauri 安全边界

状态：进行中。

目标：

- 前端业务层禁止直接使用 `invoke`、`listen`、`emit`、webview、window、store、dialog、opener、clipboard 等 Tauri API。
- 所有原生能力进入 `src/services/tauri/`，并以业务语义或插件语义命名。
- capability 保持最小权限，不新增宽泛授权。

已完成：

- `src/services/tauri/client.ts` 统一封装 command invoke 与结构化错误映射。
- `src/services/tauri/events.ts` 统一封装事件 listen/emit。
- `src/services/tauri/window.ts`、`window-state.ts`、`store.ts`、`document.ts`、`workspace.ts` 收敛主要原生能力。
- `src/services/tauri/webview.ts` 收敛当前 webview drag/drop 订阅。
- `src/services/tauri/asset.ts` 收敛 `convertFileSrc`。
- `src/services/tauri/dialog.ts`、`clipboard.ts`、`opener.ts`、`os.ts` 收敛插件 API。
- capability 已删除未使用的 `clipboard-manager:allow-write-text`，只保留当前微信复制需要的 HTML 写入权限。

剩余工作：

- 继续审计 capability 中每个权限是否仍被使用，删除有明确证据表明未使用的授权。
- 为 service 层增加必要的单元测试或 mock 验证。

## 3. 命令系统

状态：已完成主要重构，持续维护。

目标：

- 所有命令定义集中在 `src/commands/registry.ts`。
- 菜单、快捷键、命令面板和编辑器动作共享同一命令 id。
- 自定义快捷键只覆盖 registry 中存在的命令。

已完成：

- `src/commands/registry.ts` 定义命令、分组、菜单区段和默认快捷键。
- `src/commands/__tests__/registry.spec.ts` 覆盖命令唯一性和快捷键约束。
- `useCommandDispatcher` 统一分发 app/editor 命令。
- 原生菜单快捷键同步到 registry 派生结果。

剩余工作：

- 每次新增命令必须先更新 registry 和测试。
- 继续减少 UI 内散落的命令字符串。

## 4. DocumentSession

状态：已完成主要抽取，持续维护。

目标：

- `App.vue` 不直接承载打开、保存、另存、自动保存、冲突处理等文档副作用。
- 文档生命周期统一在 `useDocumentSession()` 内编排。
- dirty state 与规范化 baseline 的约定保持不变。

已完成：

- `useDocumentSession.ts` 管理打开、保存、另存、自动保存状态和冲突处理。
- `useDocumentSession.spec.ts` 覆盖打开/保存主路径和冲突分支。
- `App.vue` 已作为组合面消费 session API。

剩余工作：

- 继续降低 `App.vue` 中工作区、窗口和导出编排的耦合。
- 新增文档生命周期行为时优先补 `useDocumentSession.spec.ts`。

## 5. 巨型组件拆分

状态：进行中。

目标：

- 根组件和大型视图组件只保留组合职责。
- 独立 UI 区块拆成 focused component。
- 复杂副作用进入 composable。

已完成：

- `MarkdownEditor.vue` 已抽出搜索、命令处理、图片拖放、appearance effect、metadata helper。
- `Sidebar.vue` 已抽出文件树、搜索结果、菜单、文件对话框和大纲面板。
- `SettingsModal.vue` 已抽出 modal chrome、导航、页面 header、基础控件和各设置 panel。

剩余工作：

- 继续审计 `App.vue`、`Sidebar.vue`、`CommandPalette.vue` 等超过 300 行或职责偏多的组件。
- 拆分时保持 props down / events up，不把状态隐式塞进子组件。
- 样式迁移只移动对应组件需要的 scoped CSS。

## 6. Markdown 插件化

状态：已完成第一阶段。

目标：

- Markdown 特性通过插件 registry 接入 parser/serializer。
- parser/serializer 核心只负责调度，不继续累积特性分支。
- 新 Markdown 特性必须同时补 parse、serialize 和 round-trip 测试。

已完成：

- `src/components/Editor/tiptap/markdown/plugins/` 提供插件 registry。
- math、wikilink、Mermaid、frontmatter、callout 已插件化。
- round-trip 测试覆盖主要 Markdown fidelity 行为。

剩余工作：

- 继续把新 Markdown 语法纳入插件 registry。
- 对插件 API 增加更直接的单元测试，避免只依赖大 round-trip 覆盖。

## 7. 完成审计

整改目标只有在以下证据全部成立时才能关闭：

- `docs/REMEDIATION_PLAN.md`、`ARCHITECTURE.md`、`ENGINEERING_STANDARDS.md` 与实际实现一致。
- service 层外没有直接使用需要封装的 Tauri API。
- Rust 命令没有重新出现 `Result<T, String>`。
- command registry 是命令、菜单、快捷键和命令面板的共同来源。
- `App.vue` 和大型组件没有重新累积已抽出的副作用。
- Markdown 新语法路径都通过插件化机制进入。
- 全量验证命令通过，且只有已知、可解释的构建警告。
