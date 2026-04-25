# MarkLight Engineering Standards

更新时间：2026-04-24

本文件是 MarkLight 后续开发和 Code Review 的硬约束。

## 1. Tauri 原则

- 插件优先。能力属于设置、窗口状态、对话框、Reveal、CLI 时，优先使用官方插件。
- capability 最小权限。新窗口和新能力只申请需要的权限，不预留“大而全”授权。
- 前端业务层禁止直接 `invoke`、`listen`、`emit`。
- 所有 Tauri 边界必须经过 `src/services/tauri/`。
- 任何新的原生能力接入前，先判断能否由插件承担，再决定是否写 Rust 命令。

## 2. Rust 原则

- 对外命令禁止 `Result<T, String>`。
- 所有命令错误统一使用 `AppError`，必须返回结构化 `code + message`。
- DTO 和事件 payload 统一放在 `models.rs` 或等价模块。
- 领域模块优先于工具模块。
  例：优先 `document.rs`、`workspace.rs`、`window.rs`，不要继续堆 `fs.rs` 这类泛工具入口。
- `lib.rs` 只负责：
  - 插件注册
  - state 注入
  - 生命周期挂接
  - 命令注册
- watcher 聚合、启动打开、多窗口待处理请求必须在 Rust 端完成，前端只消费结果。

## 3. Vue 原则

- 默认使用 Vue 3 Composition API 与 `<script setup lang="ts">`。
- `App.vue` 是组合面，不直接堆复杂业务副作用。
- 复杂行为下沉到 composable：
  - 文档会话 -> `useDocumentSession`
  - 工作区会话 -> `useWorkspaceSession`
  - 窗口会话 -> `useAppWindowSession`
- 组件通信遵循 props down / events up。
- 业务组件禁止直接依赖 Tauri API；只能依赖 composable 或 service。
- Store 只存放跨组件共享状态，不承担原生能力编排。

## 4. 事件原则

- 禁止散落裸字符串事件名。
- 所有事件名集中定义在前后端事件文件中。
- 事件必须有稳定 payload 模型，禁止 `string | string[] | object` 兼容式解析。
- 当前允许的领域事件只有：
  - `menu-event`
  - `window-close-requested`
  - `app-open-paths`
  - `workspace-changed`
- 新事件进入系统前，必须先说明为何现有命令返回或现有事件无法表达。

## 5. 文档原则

- 新增领域能力或权限边界变化，必须同步更新：
  - `ARCHITECTURE.md`
  - `ENGINEERING_STANDARDS.md`
- README 里的架构描述必须与实际实现一致，不能保留历史说明。
- ROADMAP 必须反映当前阶段状态，不能继续记录已经被推翻的实现方案。

## 6. 测试与验证

- 修改 Rust 命令边界时，至少补一类测试：
  - DTO / 错误
  - 文档保存冲突
  - 工作区过滤/创建/重命名
  - watcher payload 聚合
- 修改前端 Tauri service 时，至少补：
  - 结构化错误映射
  - 事件 payload 消费
- 修改 session composable 时，至少补：
  - 打开/保存主路径
  - 关闭或冲突分支

## 7. Review Checklist

每个 PR 默认检查以下问题：

- 是否绕过了 `src/services/tauri/` 直接访问原生 API
- 是否引入了新的裸字符串事件
- 是否把运行时状态错误地塞进 settings store
- 是否把大段副作用重新堆回 `App.vue`
- 是否在 Rust 端重新出现 `Result<T, String>`
- 是否同步更新了架构和工程标准文档
