# MarkLight Roadmap

更新时间：2026-04-24

## 项目定位

MarkLight 是一款跨平台 Markdown 编辑器，目标是用桌面原生边界和结构化编辑器内核，提供稳定、快速、可扩展的本地优先写作体验。

## 当前阶段

### P0：架构基线重建 ✅

- [x] Rust 领域内核边界明确为 document / workspace / window
- [x] 统一 `AppError`、DTO、运行时 state 和事件模型
- [x] `App.vue` 降级为组合面，文档/工作区/窗口逻辑下沉为 session composable
- [x] README / ARCHITECTURE / 工程标准文档同步收敛

### P1：核心编辑器能力 ✅

- [x] TipTap 编辑器框架搭建
- [x] Markdown 解析与序列化
- [x] 标题、列表、引用、任务列表、表格、代码块、图片
- [x] 搜索替换、命令面板、快捷键、大纲、侧边栏
- [x] 文件脏状态与规范化基线

### P2：高级块与写作增强 ✅

- [x] KaTeX 数学公式
- [x] Mermaid 图表
- [x] Callout
- [x] Frontmatter
- [x] Wikilink
- [x] 上标 / 下标
- [x] Slash 命令
- [x] 块级拖拽

### P3：桌面运行时收敛 ✅

- [x] 工作区 watcher 聚合和统一 payload
- [x] 文档保存冲突检测移入 Rust
- [x] 启动打开 / 系统打开 / 新窗口待处理打开请求统一
- [x] 多窗口状态持久化
- [x] 目录树过滤规则固定在 Rust

## 进行中

### P4：产品完善

- [ ] 快捷键自定义体验继续增强
- [ ] 导出能力增强（Word / 模板化导出）
- [ ] 流程图或可视块级编辑能力
- [ ] 更完整的工作区行为测试与 Rust 单元测试
- [ ] 更细粒度的 capability 收敛与原生能力审计

## 长期方向

- 更强的插件化或扩展点设计
- 更丰富的导出模板和主题体系
- 更稳定的多窗口协同体验
- 更完整的文档资源管理能力
