# MarkLight Architecture

更新时间：2026-04-24

## 1. 系统目标与设计原则

MarkLight 是一个本地优先的 Markdown 编辑器桌面应用。系统目标不是把 Web 应用“塞进壳里”，而是围绕桌面编辑器的核心语义建立明确分层：

- Rust 负责领域状态、一致性、原生能力编排和跨窗口运行时。
- Tauri 负责插件、权限边界、窗口与事件通道。
- Vue 负责视图、交互编排和编辑器体验。
- 通用桌面能力优先使用官方插件，业务语义优先收敛到 Rust 领域内核。

核心原则：

- 领域优先：命令和事件使用文档、工作区、窗口等产品语义，不使用“通用文件工具”命名。
- 单向边界：前端不直接越权访问原生能力，所有业务入口收敛到 `src/services/tauri/`。
- 结构化契约：Rust 命令返回 DTO，Rust 错误返回结构化错误对象，事件使用固定 payload。
- 根组件降级：`App.vue` 只做组合面，不承载大块领域副作用。

## 2. 运行时拓扑

```text
Vue UI
  ├─ App shell / layout / command routing
  ├─ TipTap editor / export / theme rendering
  └─ Pinia stores
        │
        ▼
Tauri Shell
  ├─ command invoke bridge
  ├─ event bridge
  ├─ capabilities / permissions
  └─ official plugins
        │
        ▼
Rust Domain Kernel
  ├─ document domain
  ├─ workspace domain
  ├─ window runtime
  ├─ watcher / startup / pending-open state
  └─ structured errors + DTOs
        │
        ▼
Native Plugins / OS APIs
  ├─ plugin-store
  ├─ plugin-window-state
  ├─ plugin-dialog
  ├─ plugin-opener
  └─ notify / printing / window APIs
```

## 3. 边界定义

### 前端属于什么

- 编辑器渲染、命令分发、工具栏和侧边栏交互
- TipTap 文档编辑、导出 UI、主题切换
- 对 Rust DTO 和事件 payload 的消费
- 应用级 UI 状态，例如侧边栏开关、命令面板、源码模式、图片预览

### Rust 属于什么

- 打开/保存文档与冲突检测
- 工作区目录过滤、创建、重命名、回收站删除
- 目录监听、事件聚合和跨窗口运行时状态
- 启动打开文件、多窗口待处理打开请求、原生窗口关闭拦截
- 结构化错误、事件 payload、命令返回 DTO

### 官方插件优先级

以下能力优先走插件，不在业务层重复实现：

- 设置持久化：`plugin-store`
- 窗口状态：`plugin-window-state`
- 对话框：`plugin-dialog`
- Reveal / 外链：`plugin-opener`
- CLI 参数：`plugin-cli`

只有当插件不能表达编辑器业务语义时，才在 Rust 领域层补充逻辑。

## 4. 领域模型

### Document

- `open_document(path)` -> `{ path, content, lastModifiedMs }`
- `save_document(path, content, expectedLastModifiedMs, force)` -> `{ path, lastModifiedMs }`
- `import_document_image(sourcePath, documentPath)` -> `{ relativePath }`
- `resolve_document_image_path(documentPath, relativePath)` -> `{ absolutePath }`

`save_document` 在 Rust 内统一做冲突检测；冲突时返回结构化错误 `code = "document_conflict"`。

### Workspace

- `list_workspace_entries(rootPath)` -> `WorkspaceEntry[]`
- `create_workspace_entry(parentPath, kind, name)` -> `{ path, kind }`
- `rename_workspace_entry(path, newName)` -> `{ path }`
- `trash_workspace_entry(path)` -> `void`
- `watch_workspace(rootPath)` / `unwatch_workspace(rootPath)`

目录过滤规则固定在 Rust：

- 目录
- Markdown：`md` / `markdown`
- 文本：`txt`
- 图片：`png` / `jpg` / `jpeg` / `gif` / `webp` / `svg`

### Window

- `open_editor_window(path?)`
- `consume_window_open_request()`
- `consume_startup_open_request()`
- `refresh_native_menu_shortcuts(shortcuts)`
- `print_document`
- `reveal_in_finder`
- `set_window_background_color`

### Events

固定事件集合：

- `menu-event`
- `window-close-requested`
- `app-open-paths` -> `{ paths, source }`
- `workspace-changed` -> `{ rootPath, kind, paths }`

### Settings

- 设置持久化走 `plugin-store`
- `settings` store 只管理 UI 配置和主题，不管理文档/工作区/窗口运行时

### Export

- HTML / 微信导出由前端渲染器负责
- PDF 走原生打印能力
- 导出文件写入仍通过 Rust `save_document` 落盘

## 5. 核心数据流

### 打开文件

1. 前端通过 `document.ts` 调用 `open_document(path)`
2. Rust 读取文件并返回内容与 `lastModifiedMs`
3. `MarkdownEditor` 解析 Markdown 为 ProseMirror 文档
4. 编辑器在加载后立即序列化一次，建立“规范化基线”

### 保存文件

1. 前端将当前内容和 `expectedLastModifiedMs` 提交给 `save_document`
2. Rust 比较磁盘最新时间和期望值
3. 如果冲突，返回 `document_conflict`
4. 前端提示用户，必要时带 `force: true` 重试

### 打开文件夹与目录监听

1. 前端调用 `list_workspace_entries(rootPath)`
2. 前端调用 `watch_workspace(rootPath)`
3. Rust watcher 聚合 `notify` 事件并按 `rootPath + kind` 合并
4. Rust 发送 `workspace-changed`
5. 前端刷新树并决定是否重载当前文档

### 外部文件变更

- 当前文档未修改：前端可直接重新调用 `open_document`
- 当前文档已修改：前端只提示，不自动覆盖编辑状态

### 启动打开与系统打开

- 冷启动请求进入 `StartupOpenRequests`
- 新窗口待打开文件进入 `WindowOpenRequests`
- 已加载窗口在运行期通过 `app-open-paths` 事件接收路径

### 多窗口

- 每个窗口拥有自己的前端状态
- 待处理的新窗口打开请求由 Rust 按窗口 label 存储并消费一次
- 窗口状态持久化由 `plugin-window-state` 负责

## 6. 权限模型

- Capability 只声明窗口真正需要的权限
- 前端业务层禁止直接 `invoke` / `listen` / `emit`
- 原生权限必须先经过 `src/services/tauri/` 封装
- 前端不得直接访问文件系统或自行实现 watcher 语义

## 7. 前端分层

```text
App.vue
  ├─ Layout / modal composition
  ├─ useDocumentSession()
  ├─ useWorkspaceSession()
  ├─ useAppWindowSession()
  ├─ useCommandDispatcher()
  └─ useExportActions()

src/services/tauri/
  ├─ client.ts      structured invoke + error mapping
  ├─ document.ts    document commands
  ├─ workspace.ts   workspace commands
  ├─ window.ts      window/native commands
  ├─ events.ts      typed event subscriptions
  └─ store.ts       plugin-store access
```

规则：

- `App.vue` 只做组合，不直接接触 Tauri API
- 复杂副作用进入 session composable
- 组件通过 props / emits 通信，命令通过统一 dispatcher 执行

## 8. Rust 模块分层

```text
src-tauri/src/
  lib.rs          app bootstrap only
  error.rs        AppError
  models.rs       DTO + event payloads
  state.rs        runtime state + watcher runtime
  events.rs       event names + emit helpers
  menu.rs         native menu definition
  commands/
    document.rs   document commands
    workspace.rs  workspace commands
    window.rs     window/native commands
    image.rs      remote image fetch
```

规则：

- `lib.rs` 不承载业务实现
- 领域模块优先于“工具模块”
- DTO 和事件 payload 不散落在命令实现里

## 9. 维护约束

- 新增领域能力或边界变化，先更新本文件和 `ENGINEERING_STANDARDS.md`
- 新命令必须先判断是否已有官方插件可承担
- 新事件必须进入固定事件文件和类型定义
- 前后端接口变更必须同步更新测试和文档
