# CM6 性能基线（CM6-only）

> 日期：2026-03-20

## 构建基线（Production）
- 命令：`pnpm run build`
- 结果：通过
- 主包：`dist/assets/index-*.js` 约 `285 KB`（gzip 约 `107 KB`）
- 编辑器分包：`dist/assets/MarkdownEditorCM6-*.js` 约 `543 KB`（gzip 约 `187 KB`）
- Mermaid 核心分包：`dist/assets/mermaid.core-*.js` 约 `31 KB`（gzip 约 `11 KB`）
- CSS：`dist/assets/index-*.css` 约 `45.5 KB`（gzip 约 `8.7 KB`）

## 运行时关注点
- 代码块、数学块、表格、图片、Mermaid Widget 已启用。
- 搜索替换、快捷键、链接 tooltip、智能粘贴、任务列表勾选已启用。
- 构建仍存在大包体 warning（Mermaid/KaTeX/Cytoscape 相关 chunk 占比高）。

## 下一步优化方向
- 继续拆分大体量扩展与渲染器，减少编辑器主分包压力。
- 增加大文档场景压测（打开耗时、连续输入、滚动流畅度）。
