# PM 清理执行清单（分阶段）

> 目标：在保证 CM6 稳定后，安全下线 ProseMirror 代码与依赖。

## Phase A：冻结回退版本（当前版本周期）
- [ ] 完成一轮人工回归（参考 `CM6-REGRESSION-RESULTS-2026-03-20.md`）。
- [ ] 发布“默认 CM6 + PM 可回退”版本并观察一周期。
- [ ] 收集导出、拖拽、快捷键、光标类反馈。

## Phase B：先删耦合，再删实现
- [x] 导出链路彻底去 PM：新增 Markdown 直出微信渲染（已完成第一步），再覆盖剩余兜底。
- [x] 确认 `App / composables / stores` 不再静态依赖 `components/Editor/core/*`。
- [x] 清理首批 PM 仅存冗余入口（已删除 `wechat-renderer` 中无调用的 PM 渲染函数）。

## Phase C：删除 PM 代码目录
- [ ] 删除文件：`src/components/Editor/MarkdownEditor.vue`
- [ ] 删除目录：`src/components/Editor/core/`
- [ ] 删除视图：`src/components/Editor/views/CodeBlockView.vue`
- [ ] 删除视图：`src/components/Editor/views/ImageView.vue`
- [ ] 删除视图：`src/components/Editor/views/MathView.vue`
- [ ] 删除视图：`src/components/Editor/views/MermaidView.vue`
- [ ] 删除视图：`src/components/Editor/views/TableToolbar.vue`

## Phase D：删除 PM 依赖
- [ ] 移除依赖：
  - `prosemirror-commands`
  - `prosemirror-history`
  - `prosemirror-inputrules`
  - `prosemirror-keymap`
  - `prosemirror-markdown`
  - `prosemirror-model`
  - `prosemirror-schema-basic`
  - `prosemirror-schema-list`
  - `prosemirror-state`
  - `prosemirror-tables`
  - `prosemirror-transform`
  - `prosemirror-view`
- [ ] 移除开发依赖：`@types/prosemirror-tables`
- [ ] 重新安装依赖并更新 lockfile。

## Phase E：下线回退开关
- [ ] 删除 `settings.editorEngine` 字段。
- [ ] 删除设置页中的引擎切换选项。
- [ ] `App.vue` 固定加载 `MarkdownEditorCM6`。
- [ ] 清理与 PM 分支相关的条件渲染逻辑。

## Phase F：最终验证
- [ ] 执行 `pnpm run build`。
- [ ] 执行回归清单（最少一次完整人工点测）。
- [ ] 发布说明中声明 PM 已下线与迁移影响。
