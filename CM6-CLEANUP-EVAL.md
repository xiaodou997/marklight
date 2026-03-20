# CM6 后续清理评估（PM 退场路径）

> 目标：在保留一个版本回退开关的前提下，逐步移除 ProseMirror 依赖。

## A. 可立即清理（低风险）
- `src/components/Editor/core/plugins/shortcuts.ts` 中的通用定义已抽离到 `src/utils/shortcuts.ts`，后续可删 PM 版快捷键实现（待 PM 编辑器下线）。
- `src/App.vue` 已改成编辑器异步分包加载，PM 与 CM6 物理隔离已建立。

## B. 需先替换再清理（中风险）
- `src/composables/useExportActions.ts` 仍有 `CM6 markdown -> PM doc` 兜底路径。
  - 已完成：相关 PM 模块改为按需动态加载，先降低启动耦合。
  - 下一步：为微信导出新增 Markdown 直出渲染管线，去掉 `parseMarkdown/mySchema` 依赖。
- `src/utils/wechat-renderer.ts` 当前输入类型为 ProseMirror Node。
  - 下一步：新增 `renderMarkdownToWechatHtml(markdown)`，并平滑替换调用方。

## C. PM 下线时整体删除（高体量）
- `src/components/Editor/MarkdownEditor.vue`
- `src/components/Editor/core/**`
- `src/components/Editor/views/{CodeBlockView,ImageView,MathView,MermaidView,TableToolbar}.vue`
- `prosemirror-*` 系列依赖与 `@types/prosemirror-tables`
- `settings.editorEngine` 回退开关相关 UI 与逻辑

## D. 建议的退场顺序
1. 先完成导出链路去 PM 化（保障数据与对外结果稳定）。
2. 完成一次全量回归（以 `CM6-REGRESSION-CHECKLIST.md` 为准）。
3. 发布一个“默认 CM6 + PM 可回退”版本观察。
4. 下个版本删除 PM 编辑器及其依赖。
