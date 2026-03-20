# CM6 性能基线（阶段记录）

> 日期：2026-03-20  
> 目的：为后续 PM/CM6 对比提供统一口径。

## 构建基线（Production）
- 命令：`pnpm run build`
- 结果：通过
- 主包：`dist/assets/index-*.js` 约 `684 KB`（gzip 约 `220 KB`）
- CM6 编辑器分包：`dist/assets/MarkdownEditorCM6-*.js` 约 `529 KB`（gzip 约 `182 KB`）
- PM 编辑器分包：`dist/assets/MarkdownEditor-*.js` 约 `236 KB`（gzip 约 `76 KB`）
- Mermaid 核心分包：`dist/assets/mermaid.core-*.js` 约 `31 KB`（gzip 约 `11 KB`）
- CSS：`dist/assets/index-*.css` 约 `46 KB`（gzip 约 `8.9 KB`）

## 运行时关注点
- Live Preview、代码块/数学块/表格 Widget 已启用。
- 图片 Widget、Mermaid Widget 已启用（非光标行渲染，光标进入恢复源码）。
- Mermaid 运行时改为动态加载，避免首屏主包强依赖。
- 搜索、快捷键、图片拖放、任务列表勾选、气泡菜单、智能粘贴、链接 tooltip 已接入 CM6。
- 仍存在大包体 warning（Mermaid/KaTeX/Cytoscape 相关 chunk 占比高）。
- 编辑器组件已改为异步加载，默认启动路径主包压力明显下降。

## 下一步对比项（待执行）
- 同一份大文档下，PM 与 CM6 的以下指标对比：
  - 首次打开到可编辑时间
  - 连续输入 1000 次的平均帧耗时
  - 行切换触发渲染的抖动情况
  - 大纲更新延迟
- 导出链路（HTML/PDF/微信）在 CM6 下的耗时采样。
