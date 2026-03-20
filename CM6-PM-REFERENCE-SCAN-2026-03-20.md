# PM 引用扫描（Phase B/C）

> 扫描时间：2026-03-20  
> 目标：确认“可安全删除的第一批”并给出已执行补丁。

## 1. 扫描结论
- `src/App.vue / src/composables / src/stores` 已不再静态引用 `src/components/Editor/core/*`。
- PM 运行路径仍集中在：
  - `src/components/Editor/MarkdownEditor.vue`
  - `src/components/Editor/core/**`
  - `src/components/Editor/views/{CodeBlockView,ImageView,MathView,MermaidView,BubbleMenu,TableToolbar}.vue`
- 在“保留 PM 回退开关”的前提下，上述 PM 文件暂不属于“可安全整文件删除”范围。

## 2. 可安全删除第一批（已执行）

### 2.1 代码删除（已落地）
- 删除 `src/utils/wechat-renderer.ts` 中已无调用的 PM 渲染入口：
  - `renderToWechatHtml(doc: ProsemirrorNode, themeId?)`
- 删除该文件中的 `prosemirror-model` 类型依赖导入。

### 2.2 耦合清理（已落地）
- `src/App.vue` 复制逻辑改为统一调用编辑器暴露接口 `getSelectionMarkdown()`，不再静态依赖 `./components/Editor/core/markdown`。
- `src/components/Editor/MarkdownEditor.vue` / `MarkdownEditorCM6.vue` 已统一暴露 `getSelectionMarkdown()`。

## 3. 本批“整文件可删”清单
- 无（原因：PM 回退路径仍在线，删文件会直接破坏回退能力）。

## 4. 下一批建议（进入 Phase C 的前置条件）
- 完成 PM 回退开关下线后，可整批删除：
  - `src/components/Editor/MarkdownEditor.vue`
  - `src/components/Editor/core/**`
  - `src/components/Editor/views/{CodeBlockView,ImageView,MathView,MermaidView,TableToolbar}.vue`
