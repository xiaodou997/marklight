# 更新日志（Changelog）

本项目所有值得记录的变更都会写入本文件。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> 各正式版本的发布说明由 CI（`.github/workflows/build.yml`）按 Conventional Commits
> 自动生成到 GitHub Release；本文件按相同分类汇总，便于在仓库内浏览历史。

## [Unreleased]

## [1.1.5] - 2026-06-14

### 🚀 新功能
- feat(editor): 粘贴 Markdown 表格自动识别为表格节点 (#9)
- feat(editor): 支持 `[文字](url)` 链接直输 (#7)

### 🧪 测试
- test: 给粘贴表格加真实 EditorView 端到端测试 (#10)
- test: 给 IME/输入编排路径加自动化回归测试 (#6)

## [1.1.4] - 2026-06-14

### 🐛 修复
- fix: restore inline markdown formatting

### 🔨 代码重构
- refactor: 统一 Markdown 输入内核为单一 WYSIWYG 引擎 (#5)

### 🏗️ 维护与工程
- chore: prepare v1.1.4 release

## [1.1.3] - 2026-06-12

### 🏗️ 维护与工程
- chore: prepare v1.1.3 release
- chore: refresh npm lockfile

## [1.1.2] - 2026-06-12

### 🏗️ 维护与工程
- chore: sync cargo lock for v1.1.2
- chore: prepare v1.1.2 release
- chore: migrate package manager to npm

## [1.1.1] - 2026-06-12

### 🐛 修复
- fix: restrict tauri asset access
- fix: harden rich content rendering
- fix: keep empty headings in pending state
- fix: buffer early macos open events
- fix: improve cold start document handoff
- fix: handle startup file open reliably
- fix: stabilize remote image rendering
- fix: harden sync workflow and editor rendering

### ⚡ 性能优化
- perf: optimize remote image loading

### 🔨 代码重构
- refactor: extract app ui state
- refactor: extract app editor state
- refactor: extract editor extension setup
- refactor: extract app dom event handling
- refactor: split sidebar files panel
- refactor: extract theme editor state
- refactor: split theme editor panels
- refactor: split theme selector cards
- refactor: split command palette views
- refactor: split app editor view surfaces
- refactor: wrap tauri plugin services
- refactor: wrap tauri dialog service
- refactor: wrap tauri webview services
- refactor: extract appearance settings panel
- refactor: extract shortcut settings panel
- refactor: extract editor settings panel
- refactor: extract export settings panel
- refactor: extract save settings panel
- refactor: extract tab width selector
- refactor: extract settings font select
- refactor: extract wechat theme selector
- refactor: extract settings page header
- refactor: split settings modal chrome
- refactor: extract settings sidebar nav
- refactor: extract settings range field
- refactor: extract settings switch control
- refactor: extract editor appearance effects
- refactor: extract shortcut settings logic
- refactor: extract editor image drop handler
- refactor: extract editor command handlers
- refactor: extract editor metadata helpers
- refactor: extract editor search logic
- refactor: split sidebar file dialogs
- refactor: split sidebar menus
- refactor: split sidebar outline panel
- refactor: split sidebar file tree views
- refactor: pluginize markdown callouts
- refactor: pluginize markdown frontmatter
- refactor: pluginize markdown mermaid blocks
- refactor: pluginize markdown wikilinks
- refactor: add markdown syntax plugin registry
- refactor: pluginize markdown math handlers
- refactor: extract file tree node component
- refactor: centralize tauri command names
- refactor: adopt semantic editor model

### 📚 文档更新
- docs: mark component split maintained
- docs: update app ui split status
- docs: update app split status
- docs: update remediation audit status
- docs: sync architecture standards
- docs: update component split progress
- docs: mark tauri boundary remediated
- docs: add remediation plan
- docs: add localized readmes

### 🏗️ 维护与工程
- chore: prepare v1.1.1 release
- chore: upgrade tauri and frontend deps
- chore: upgrade dependencies
- chore: tighten clipboard capability
- chore: expose startup diagnostics log

### 📝 其他变动
- test: cover markdown plugin registry
- test: harden command registry contracts
- test: cover tauri plugin services
- test: cover tauri document workspace services
- test: cover document session workspace changes

## [1.1.0] - 2026-04-25

### 🚀 新功能
- feat: refine settings modal layout
- feat: polish theme gallery and editing flow
- feat: 支持在渲染态直接编辑图片源码
- feat: 支持在渲染态编辑代码块语言
- feat: 多套主题/自定义样式系统

### 🐛 修复
- fix: clear blocking eslint errors
- fix(ui): clarify confirmation dialog actions
- fix: align mac window chrome with app theme
- fix: clean up editor settings controls
- fix: make new window file open reliable
- fix: 调整行内 token 可见性判断
- fix: 收紧标题前导槽位并对齐正文起点
- fix: 修复公式图片保真并补强空行渲染
- fix: 修复表格空闲态外边框缺失
- fix: 增强表格外边框可见性
- fix: 同步外部文件变更并补齐基础测试

### 🔨 代码重构
- refactor: move app to rust domain kernel architecture
- refactor: normalize tauri event handling
- refactor: tighten tauri permissions and event flow
- refactor: modernize tauri service and state layers
- refactor: unify settings page sections and controls
- refactor: simplify app theme selection
- refactor: rebuild export pipeline around editor document
- refactor: unify commands and export flow

### 📚 文档更新
- docs: organize project documentation

### 🏗️ 维护与工程
- chore: prepare v1.1.0 release
- chore: clean up eslint warnings
- chore: update dependencies and adapt latest types
- chore: migrate package manager to bun

### 📝 其他变动
- test: cover menu sync and window open flow
- test: cover export contract and config writes
- test: cover command dispatch and file safety

## [1.0.0] - 2026-04-19

### 🚀 新功能
- feat: Typora 风格 token 可见性 — 语法符号默认隐藏，光标进入时显示
- feat: 方案C Phase D — 将链接语法符号迁移为实体节点，删除 inline-deco.ts
- feat: 方案C Phase B+C — 将 highlight/sup/sub/code 语法符号迁移为实体节点
- feat: 方案C Phase A — 将 bold/italic/strike 语法符号从 Decoration 迁移为实体节点
- feat: 添加斜杠命令菜单和块拖拽排序功能
- feat: 添加上标/下标和 Wikilink 支持，完成 P2 全部功能
- feat: 编辑器从 CM6 迁移至 TipTap，实现 Typora 风格所见即所得编辑
- feat: 完善CM6编辑器功能 - 添加装饰器、主题、新扩展组件和挂件支持
- feat: 重构侧边栏为可折叠文件树
- feat: decouple export from PM and add regression/cleanup docs
- feat: support hover-triggered cm6 link tooltip
- feat: enhance cm6 live preview for hr and inline marks
- feat: add cm6 image/mermaid widgets and async editor loading
- feat: add cm6 link tooltip interaction
- feat: complete cm6 phase4 interactions and default switch
- feat: add cm6 code and math block widgets
- feat: support cm6 task checkbox toggle
- feat: add cm6 shortcuts and image drop support
- feat: add cm6 live preview and migration checklist
- feat: add codemirror6 editor engine toggle
- feat: rewrite syntax-reveal plugin with real text editing approach

### 🐛 修复
- fix: 修复 token 同步 plugin 无限循环和文件切换 dirty 误判
- fix: 修复打开文件后误判为 dirty 导致切换文件弹出未保存提示
- fix: 修复代码块 RangeSetBuilder 排序错误导致渲染失效
- fix: 改善代码块渲染样式，支持内联编辑
- fix: 修复 CM6 编辑器五项渲染与交互问题
- fix: don't emit in on_page_load, let notify_frontend_ready push the file
- fix: re-enable CLI arg file opening for macOS (dev mode testing)
- fix: add on_page_load hook for reliable macOS cold-start file opening
- fix: resolve macOS cold-start file-open race condition with push model
- fix: capture macOS open-with file event via RunEvent::Opened
- fix: avoid startup file-open event race on macOS
- fix: open associated files on macOS and robustly parse open events
- fix: resolve Vue template crash and rename CSS class prefix to mk-
- fix: improve CM6 editor rendering and fix shortcuts
- fix: resolve CM6 editor rendering issues
- fix: log cm6 drag-drop listener fallback errors

### ⚡ 性能优化
- perf: lazy-load mermaid in pm and cm6 renderers

### 🔨 代码重构
- refactor: remove prosemirror editor implementation files
- refactor: remove remaining app-level PM static coupling
- refactor: lazy-load pm export modules in cm6 path
- refactor: extract shared shortcuts definitions for cm6 migration
- refactor: optimize cm6 export data path

### 📚 文档更新
- docs: add CM6 manual regression runbook and release notes draft
- docs: update cleanup checklist after build verification
- docs: add cm6 cleanup evaluation and update risk tracking
- docs: add cm6 performance baseline and m5 tracking

### 🏗️ 维护与工程
- chore: 发布 v1.0.0 正式版
- chore: finalize cm6-only docs and remove legacy compatibility path
- chore: remove prosemirror deps and retire engine fallback
- chore: checkpoint before cm6 migration

## [0.2.2] - 2026-03-15

### 🚀 新功能
- feat: preserve list markers
- feat: extend marker edit for lists
- feat: edit heading markers inline
- feat(theme): implement theme system architecture and UI variable adaptation. refactor: slim down App.vue with useMenuEvents.
- feat(heading): 支持标题级别快捷编辑

### 🐛 修复
- fix: resolve TypeScript errors in source-reveal plugin
- fix: show ordered list markers in source edit
- fix: resolve build type errors
- fix: unify list marker rendering
- fix: remove marker prefix after cursor leaves
- fix: improve image drag-drop and edit UX
- fix(editor): fix image drop failure and enforce asset localization
- fix(file): 优化文件修改检测逻辑

### 🔨 代码重构
- refactor: split tauri commands and export actions

### 🏗️ 维护与工程
- chore: bump version to 0.2.2
- chore: bump pnpm to 10.32.1

## [0.2.1] - 2026-03-10

### 🚀 新功能
- feat(table): 表格编辑增强
- feat(file-association): 支持双击打开 md 文件
- feat(shortcuts): 快捷键自定义功能
- feat(config): 配置持久化到应用数据目录
- feat(settings): 添加快捷键说明 tab
- feat(shortcuts): 添加快捷键系统，支持 Mac/Win 跨平台
- feat(ui): implement platform-aware immersive titlebar for Windows/Linux while preserving macOS native look
- feat(editor): improve math editing and disable devtools for production
- feat: 添加图片代理协议解决构建版本网络图片403问题
- feat: 添加图片点击预览功能并优化图片加载

### 🐛 修复
- fix(tauri): correct CLI argument parsing for Windows build
- fix(editor): restore syntax highlighting and fix variable visibility in code blocks

### ⚡ 性能优化
- perf: 优化网络图片异步加载，添加加载动画和缓存

### 📚 文档更新
- docs: finalize Apache-2.0 license and update website

### 🏗️ 维护与工程
- chore: bump version to v0.2.1 and update changelog
- chore: remove unintended file
- chore: 切换到 Apache 2.0 许可

## [0.2.0-beta.1] - 2026-03-07

### 🐛 修复
- fix: 删除 notify 文件监听相关代码

### 📝 其他变动
- security: 将 Gitee 仓库地址移至 Secrets

## [0.2.0] - 2026-03-07

### 🚀 新功能
- feat: integrate help menu, GitHub links and introduce Chinese name '墨光'
- feat(fs): integrate notify for real-time file system watching
- feat(safety): implement file modification conflict detection
- feat(platform): abstract cross-platform shortcut logic and modifier keys
- feat: 实现数学公式预览气泡功能
- feat: 完成剩余低优先级任务
- feat: 实现文件树操作增强
- feat: 实现命令面板
- feat: 实现数学公式预览气泡
- feat: 实现代码块语言搜索
- feat: 实现微信导出主题配置
- feat: 实现 PDF 导出功能
- feat: 实现焦点写作模式
- feat: 实现链接插入 UI
- feat: 实现多窗口支持
- feat: 实现图片本地化存储
- feat: 实现搜索替换功能
- feat: 实现自动保存功能
- feat: 更新 Windows Store 图标
- feat: 更新应用图标
- feat: MarkLight v1.0.0-alpha - 初始版本

### 🐛 修复
- fix(tauri): provide explicit type for None in open_path call
- fix(store): export isLoading and setLoading from fileStore
- fix(tauri): adapt reveal_in_finder for Linux compatibility
- fix: Markdown 解析器添加降级处理
- fix: 修复三个问题
- fix: 修复 CODE_REVIEW_REPORT 中的问题
- fix: 根据标签自动判断 prerelease 或正式版
- fix: 简化 workflow，使用 tauri-action 的 Draft Release
- fix: 添加 GitHub Actions 写入权限以创建 Release
- fix: 修复网络图片加载问题，添加 GitHub Actions 跨平台构建
- fix: 修复 TypeScript 错误和 bundle identifier 警告

### 🎨 UI 与样式
- style(ui): implement custom titlebar for Win/Linux and beautify scrollbars
- style(ui): adapt shortcut labels and file manager terminology for all platforms

### ⚡ 性能优化
- perf: 用户体验性能优化

### 🔨 代码重构
- refactor: 优化快捷键配置，与主流 macOS 应用保持一致

### 📚 文档更新
- docs: 更新 README 许可说明
- docs: finalize v0.2.0 documentation and cleanup repository
- docs: 添加代码审查报告汇总
- docs: 更新架构文档以反映当前实现

### 🏗️ 维护与工程
- chore: 改用 GPL-3.0 + 商业许可双许可模式
- chore: remove redundant reports, images and legacy documentation
- chore: add project icon file
- chore: bump version to v0.2.0 and implement loading states & file associations

