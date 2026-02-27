# MarkLight 迭代路线图

> 基于现有 v1.0.0-alpha 版本的后续开发计划。任务按优先级排列，高优先级任务应先实施。
> 每个任务包含：背景、目标、实现方案、验收条件。

---

## 优先级说明

| 标记 | 含义 |
|------|------|
| 🔴 高 | 用户感知强，缺失明显，优先实现 |
| 🟡 中 | 提升完整度，按顺序推进 |
| 🟢 低 | 锦上添花，有余力时实现 |

---

## 任务总览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|------|
| T1 | 自动保存 | 🔴 高 | 待开发 |
| T2 | 搜索替换 | 🔴 高 | 待开发 |
| T3 | 图片本地化存储 | 🔴 高 | 待开发 |
| T4 | 多窗口支持 | 🟡 中 | 待开发 |
| T5 | 链接插入 UI | 🟡 中 | 待开发 |
| T6 | 焦点写作模式 | 🟡 中 | 待开发 |
| T7 | PDF 导出 | 🟡 中 | 待开发 |
| T8 | 微信导出主题配置 | 🟡 中 | 待开发 |
| T9 | 代码块语言搜索 | 🟡 中 | 待开发 |
| T10 | 数学公式预览气泡 | 🟢 低 | 待开发 |
| T11 | 命令面板 | 🟢 低 | 待开发 |
| T12 | 文件树操作增强 | 🟢 低 | 待开发 |

---

## 详细任务说明

---

### T1 自动保存

**优先级**: 🔴 高

**背景**

当前只有手动保存（Cmd+S）。用户写作时很容易忘记保存，意外关闭应用会丢失内容。设置 UI 已有自动保存开关和间隔选项，但逻辑未实现。

**目标**

- 文档内容有变动后，在用户停止输入 N 秒（可配置）后自动写入磁盘
- 仅当文件已有保存路径时才自动保存（新文件不自动保存，避免弹对话框打断写作）
- 状态栏提示保存状态

**实现方案**

1. 在 `src/composables/useFileOperations.ts` 中添加 `setupAutoSave(editorRef)` 函数
2. 监听 `fileStore.isDirty` 变化，使用 `watchEffect` + `setTimeout` 实现防抖保存
3. 读取 `settingsStore.autoSave`（布尔）和 `settingsStore.autoSaveInterval`（毫秒）控制行为
4. 保存成功后调用 `fileStore.markSaved()`，同时在状态栏短暂显示"已自动保存"提示（2秒后消失）
5. 在 `App.vue` 的 `onMounted` 中调用 `setupAutoSave`

**关键代码位置**

- `src/composables/useFileOperations.ts` — 添加自动保存逻辑
- `src/stores/settings.ts` — `autoSave`, `autoSaveInterval` 字段已存在
- `src/stores/file.ts` — `isDirty`, `markSaved()` 已存在
- `src/components/StatusBar.vue` — 添加保存状态提示

**验收条件**

- [ ] 设置中关闭自动保存，编辑后不自动保存
- [ ] 设置中开启自动保存，停止输入指定秒数后文件自动保存（窗口标题 `*` 消失）
- [ ] 新建未保存的文件，自动保存不触发
- [ ] 保存期间快速关闭应用，内容不丢失
- [ ] 状态栏有"已自动保存"短暂提示

---

### T2 搜索替换

**优先级**: 🔴 高

**背景**

文本编辑器最基础的功能之一。当前只能依赖系统级搜索（不支持文档内定位），长文档中找词很不方便。

**目标**

- Cmd+F 打开搜索栏，在文档中高亮所有匹配项，可前后跳转
- Cmd+H 或点击"替换"展开替换输入框，支持单个替换和全部替换
- 支持大小写敏感选项
- Esc 关闭搜索栏，恢复光标位置

**实现方案**

1. 安装 `prosemirror-search`（官方搜索插件），或自行实现基于 Decoration 的高亮方案
   - 推荐自实现：`prosemirror-search` API 较底层，自实现可以更好地控制 UI
2. 新建 `src/components/Editor/core/plugins/search.ts`
   - Plugin state 存储：`query`, `caseSensitive`, `matches[]`, `currentIndex`
   - 每次 doc 变化或 query 变化时重新计算所有匹配位置
   - 用 `Decoration.inline` 高亮所有匹配，用不同颜色标记当前匹配项
   - 暴露命令：`findNext`, `findPrev`, `replaceOne`, `replaceAll`
3. 新建 `src/components/SearchBar.vue`
   - 绝对定位，固定在编辑器顶部右侧
   - 输入框、匹配计数（如"3/12"）、前后翻页按钮、大小写开关
   - 替换输入框默认收起，点击展开
4. 在 `App.vue` 监听 `Cmd+F` 和 `Cmd+H` 快捷键，控制 SearchBar 显隐
5. Tauri 菜单"编辑 → 查找"事件联动

**关键代码位置**

- `src/components/Editor/core/plugins/search.ts` — 新建
- `src/components/SearchBar.vue` — 新建
- `src/components/Editor/MarkdownEditor.vue` — 注册 search 插件，暴露搜索命令
- `src/App.vue` — 绑定快捷键，控制 SearchBar 显隐
- `src-tauri/src/lib.rs` — 菜单"查找/替换"事件

**验收条件**

- [ ] Cmd+F 打开搜索栏，输入关键词，文档内所有匹配项高亮
- [ ] 状态显示"当前/总数"，如"2/8"
- [ ] Enter / 点击下一个，跳转到下一个匹配项，编辑器自动滚动到可视区域
- [ ] Shift+Enter / 点击上一个，跳转到上一个
- [ ] 大小写开关切换后，匹配结果实时更新
- [ ] Cmd+H 展开替换框，"替换"按钮替换当前项，"全部替换"一次性替换所有
- [ ] Esc 关闭搜索栏，高亮消失
- [ ] 文档为空时，搜索不报错

---

### T3 图片本地化存储

**优先级**: 🔴 高

**背景**

当前粘贴/拖拽图片会生成 data URL 嵌入文档，一张截图可能让 .md 文件膨胀几 MB，且无法被其他 Markdown 工具正常显示。标准做法是将图片保存为独立文件，Markdown 中写相对路径。

**目标**

- 粘贴或拖拽图片时，自动将图片保存到与当前文件同目录的 `assets/` 文件夹中
- Markdown 中插入相对路径引用，如 `![](assets/image-20240301-143022.png)`
- 文件未保存时（无路径），降级为 data URL，并在状态栏提示"请先保存文件以启用图片本地化"

**实现方案**

1. 在 `src-tauri/src/lib.rs` 新增 Rust 命令 `save_image(dir: String, filename: String, data: Vec<u8>) -> String`
   - 接收图片字节数据，写入 `{dir}/assets/{filename}`，返回相对路径
2. 在 `src/components/Editor/core/plugins/image-handle.ts` 修改图片插入逻辑
   - 从剪贴板/拖拽事件获取图片 File 对象
   - 用 `FileReader` 读取为 ArrayBuffer
   - 生成文件名：`image-{timestamp}-{random4}.{ext}`
   - 判断 `fileStore.path` 是否存在
     - 有路径：调用 `invoke('save_image', ...)` 获取相对路径，插入 `![](assets/xxx.png)`
     - 无路径：插入 data URL，同时 emit 一个警告事件给 App.vue 在状态栏显示提示
3. `ImageView.vue` 渲染图片时，若 src 是相对路径，拼接当前文件目录的绝对路径（通过 `fileStore.path` 计算）用于在 Tauri webview 中加载

**关键代码位置**

- `src-tauri/src/lib.rs` — 新增 `save_image` 命令
- `src/components/Editor/core/plugins/image-handle.ts` — 修改插入逻辑
- `src/components/Editor/views/ImageView.vue` — 修改图片路径解析
- `src/stores/file.ts` — 提供当前文件目录路径的 getter

**验收条件**

- [ ] 文件已保存的情况下，粘贴图片后，`assets/` 目录下出现图片文件
- [ ] Markdown 文件中存储的是相对路径，如 `![](assets/image-xxx.png)`
- [ ] 编辑器内图片正常显示（相对路径正确解析）
- [ ] 文件未保存时，图片以 data URL 插入，状态栏出现提示
- [ ] 生成的文件名不重复（含时间戳）
- [ ] 用其他 Markdown 工具打开该文件，图片能正常显示

---

### T4 多窗口支持

**优先级**: 🟡 中

**背景**

当前一次只能打开一个文件，需要切换时会提示保存/放弃。与 Typora 保持一致，采用多窗口方案：每个窗口独立编辑一个文件，可并排对比，实现成本也远低于多 Tab（不需要重构 file store）。

**目标**

- `Cmd+N` 新建一个空白窗口
- 文件树中 `Cmd+单击` 在新窗口中打开文件
- 每个窗口独立维护文件状态、编辑历史，互不干扰
- 关闭窗口时，若有未保存内容，弹出确认对话框

**实现方案**

1. 在 `src-tauri/src/lib.rs` 新增 Tauri 命令 `open_new_window(path: Option<String>)`
   - 调用 `WebviewWindowBuilder::new()` 创建新窗口，配置与主窗口相同的尺寸/标题
   - 若传入 `path`，通过窗口事件将路径传给新窗口的前端，前端收到后自动打开该文件
2. 在 `src/App.vue` 中：
   - 监听 `Cmd+N` 快捷键，调用 `invoke('open_new_window')`
   - 监听 Tauri 窗口创建事件，接收初始文件路径并打开
3. 文件树组件 `Sidebar.vue` 中，对文件列表项增加 `Cmd+单击` 事件处理，调用 `invoke('open_new_window', { path })`
4. 在 `src-tauri/src/lib.rs` 菜单"文件 → 新建窗口"事件联动

**关键代码位置**

- `src-tauri/src/lib.rs` — 新增 `open_new_window` 命令，菜单项
- `src/App.vue` — 快捷键绑定，接收初始路径
- `src/components/Editor/Sidebar.vue` — Cmd+单击处理

**注意事项**

- 每个窗口是独立的 webview 实例，file store 和 settings store 各自独立，无需跨窗口同步
- 设置变更只影响当前窗口；若希望设置全局生效，依赖 localStorage 在下次窗口创建时读取即可

**验收条件**

- [ ] `Cmd+N` 打开一个新的空白窗口
- [ ] 菜单"文件 → 新建窗口"同样有效
- [ ] 文件树中 `Cmd+单击` 文件，在新窗口中打开该文件
- [ ] 两个窗口可同时编辑不同文件，互不影响（各自有独立的撤销历史）
- [ ] 关闭有未保存内容的窗口时，弹出"是否保存"确认对话框
- [ ] 新窗口的窗口标题正确显示文件名

---

### T5 链接插入 UI

**优先级**: 🟡 中

**背景**

当前选中文本后气泡菜单只有 Bold/Italic/Code/H1/H2，没有插入链接的功能。插入链接需要手动输入 `[text](url)`，体验差。

**目标**

- 气泡菜单增加"链接"按钮（🔗）
- 点击后弹出小型 Popover，含 URL 输入框，Enter 确认插入
- 对已有链接：点击链接时工具提示显示 URL，支持"复制链接"和"打开链接"

**实现方案**

1. `src/components/Editor/views/BubbleMenu.vue` 增加链接按钮
2. 点击链接按钮后，在气泡菜单下方展开一个 URL 输入区域（inline 展开，不用单独 Popover）
   - 输入框自动聚焦
   - Enter 确认：调用 ProseMirror 命令将选中文本包裹为 link mark，attrs 含 href
   - Esc 取消
3. `src/components/Editor/core/plugins/bubble-menu.ts` 中的 `handleMenuAction` 增加 `link` 类型处理
4. 对已有链接，修改 `source-reveal.ts` 或新增 click handler：单击链接时弹出小型 tooltip
   - 显示 URL（截断超长的）
   - "复制"按钮、"在浏览器打开"按钮（调用 `@tauri-apps/plugin-opener`）

**关键代码位置**

- `src/components/Editor/views/BubbleMenu.vue` — 增加链接按钮和 URL 输入区
- `src/components/Editor/core/plugins/bubble-menu.ts` — 增加 link 操作处理
- `src/components/Editor/core/plugins/source-reveal.ts` — 链接点击处理（或新建插件）

**验收条件**

- [ ] 选中纯文本，气泡菜单出现链接按钮
- [ ] 点击链接按钮，展开 URL 输入框
- [ ] 输入 URL 后按 Enter，选中文本变为超链接
- [ ] 单击已有链接，出现 tooltip 显示 URL
- [ ] tooltip 中"复制链接"复制 URL 到剪贴板
- [ ] tooltip 中"打开链接"在默认浏览器中打开
- [ ] 选中已有链接文本，气泡菜单链接按钮处于激活状态（有高亮），点击可编辑或移除链接

---

### T6 焦点写作模式

**优先级**: 🟡 中

**背景**

写作时希望排除干扰，聚焦在内容本身。当前侧边栏、工具栏、状态栏等元素始终可见，界面信息较多。

**目标**

- 一键进入焦点模式：隐藏所有 UI 元素，内容区居中窄栏显示，纯白/纯黑背景
- Esc 或再次触发退出焦点模式
- 焦点模式下鼠标移到顶部时，临时显示工具栏（类似全屏视频控件）

**实现方案**

1. `src/stores/settings.ts` 增加 `isFocusMode: boolean` 状态
2. `src/App.vue` 根据 `isFocusMode` 控制侧边栏、工具栏、状态栏的显隐（`v-show`）
3. 焦点模式下，编辑器容器 CSS 改为：
   ```css
   max-width: 720px;
   margin: 0 auto;
   padding: 60px 0;
   ```
4. 绑定快捷键 `Cmd+Shift+F`（macOS）/ `F11`（Windows/Linux）切换
5. `src-tauri/src/lib.rs` 菜单"视图 → 焦点模式"事件
6. 鼠标悬停顶部区域时临时显示工具栏，使用 CSS `opacity` transition 平滑过渡

**关键代码位置**

- `src/stores/settings.ts` — 增加 `isFocusMode`
- `src/App.vue` — 控制 UI 显隐，绑定快捷键
- `src/assets/styles/main.css` — 焦点模式样式
- `src-tauri/src/lib.rs` — 菜单事件

**验收条件**

- [ ] Cmd+Shift+F 进入焦点模式，侧边栏、状态栏隐藏，内容居中
- [ ] 内容区宽度约 720px，左右留白
- [ ] 再次按快捷键或 Esc 退出焦点模式，所有 UI 恢复
- [ ] 焦点模式状态在设置 store 中保存，切换文件后保持
- [ ] 鼠标移到顶部时，工具栏淡入显示

---

### T7 PDF 导出

**优先级**: 🟡 中

**背景**

HTML 导出已有，但实际分享/打印场景中 PDF 更通用，微信导出只适合公众号场景。

**目标**

- "文件 → 导出 PDF"将当前文档导出为 PDF 文件
- 导出样式与编辑器当前主题一致（代码高亮、数学公式、表格均正常渲染）

**实现方案**

方案A（推荐）：利用 Tauri webview 的打印能力
1. 在 `src-tauri/src/lib.rs` 新增命令，调用 Tauri 窗口的 `print()` 方法（Tauri 2.0 支持通过 `WebviewWindow::print()`）
2. 前端触发前，临时将编辑器切换为"打印视图"（隐藏所有工具 UI，内容全展开）
3. 调用 `invoke('print_to_pdf')` 触发系统打印对话框，用户选择"另存为 PDF"

方案B（备选）：HTML → PDF
1. 先用现有 `exportHtml()` 生成完整 HTML 字符串（含 CSS、数学公式）
2. 在 `src-tauri/src/lib.rs` 中创建隐藏的临时 webview 加载该 HTML，调用打印

优先采用方案A，跨平台一致性更好。

**关键代码位置**

- `src-tauri/src/lib.rs` — 新增 print 命令
- `src/App.vue` — 导出 PDF 菜单处理
- `src/assets/styles/main.css` — 添加 `@media print` 样式规则

**验收条件**

- [ ] "文件 → 导出 PDF"触发系统打印对话框
- [ ] 导出的 PDF 包含正确的标题层级、代码高亮、数学公式
- [ ] 打印时不显示侧边栏、工具栏、气泡菜单等 UI 元素
- [ ] 分页合理，不在标题和内容之间断页
- [ ] macOS / Windows 均可正常导出

---

### T8 微信导出主题配置

**优先级**: 🟡 中

**背景**

当前 `wechat-renderer.ts` 中的样式是硬编码的蓝色主题，不同用户有不同的排版偏好，无法修改。

**目标**

- 提供 3-5 套预设微信导出主题（默认蓝色、绿色极简、黑金、橙色暖调等）
- 设置页面中可选择默认主题
- 导出时使用选中的主题

**实现方案**

1. 在 `src/utils/wechat-renderer.ts` 中，将 `STYLES` 重构为接受主题参数的函数 `getStyles(theme: WechatTheme)`
2. 新建 `src/utils/wechat-themes.ts`，定义主题接口和预设主题数据
   ```typescript
   interface WechatTheme {
     name: string
     primaryColor: string   // 标题、链接颜色
     codeColor: string      // 行内代码文字色
     codeBg: string         // 行内代码背景色
     blockquoteBg: string   // 引用背景色
     // ...
   }
   ```
3. `src/stores/settings.ts` 增加 `wechatTheme: string` 字段（存主题 name）
4. `src/components/Settings/SettingsModal.vue` 在"导出"分组中增加主题选择器，展示主题名称和颜色预览色块
5. `App.vue` 的 `copyToWechat()` 读取 `settingsStore.wechatTheme` 传给 `renderToWechatHtml`

**关键代码位置**

- `src/utils/wechat-renderer.ts` — 支持主题参数
- `src/utils/wechat-themes.ts` — 新建，定义预设主题
- `src/stores/settings.ts` — 增加 `wechatTheme` 字段
- `src/components/Settings/SettingsModal.vue` — 增加主题选择 UI

**验收条件**

- [ ] 设置页面"导出"分组中可以选择微信主题
- [ ] 至少提供 3 套预设主题，有颜色预览
- [ ] 切换主题后，复制到微信的 HTML 样式随之变化
- [ ] 主题设置持久化，重启应用后保留

---

### T9 代码块语言搜索

**优先级**: 🟡 中

**背景**

`CodeBlockView.vue` 当前使用静态下拉列表约 15 种语言，常见语言如 `yaml`, `dockerfile`, `kotlin`, `swift` 等未收录。highlight.js 支持 180+ 种，应允许用户搜索选择。

**目标**

- 代码块语言选择器改为可搜索的输入框
- 输入语言名称实时过滤，支持模糊匹配
- 显示 highlight.js 支持的所有语言

**实现方案**

1. 修改 `src/components/Editor/views/CodeBlockView.vue`
   - 将 `<select>` 改为自定义 combobox 组件（输入框 + 下拉列表）
   - 数据来源：`lowlight.listLanguages()` 获取所有支持的语言名
   - 输入时用 `String.includes()` 做简单过滤，展示前 20 条
   - 键盘：↑↓ 选择，Enter 确认，Esc 关闭
2. 语言确认后更新 ProseMirror node 的 `language` 属性，触发高亮重渲染

**关键代码位置**

- `src/components/Editor/views/CodeBlockView.vue` — 改造语言选择器

**验收条件**

- [ ] 点击语言标签，出现搜索输入框
- [ ] 输入"py"，列表中出现"python"等匹配项
- [ ] 键盘方向键可以导航列表
- [ ] 选择语言后，代码块立即重新高亮
- [ ] 输入不存在的语言名，显示"不支持此语言"提示，代码块退回纯文本

---

### T10 数学公式预览气泡

**优先级**: 🟢 低

**背景**

行内公式 `$E=mc^2$` 当前以原始文本形式显示（只有光标移入时才渲染？需确认），块级公式用 MathView 渲染。行内公式的编辑体验不够直观。

**目标**

- 光标位于行内公式 `$...$` 内时，在公式上方显示 KaTeX 渲染后的预览气泡
- 气泡随光标移动保持定位
- 公式有语法错误时，气泡显示红色错误提示

**实现方案**

1. 新建 `src/components/Editor/core/plugins/math-preview.ts`
   - 监听 selection 变化，判断光标是否在 `math_inline` 节点内
   - 若是，获取节点的 `latex` 属性，用 KaTeX 渲染为 HTML 字符串
   - 创建 tooltip DOM 元素，定位到节点位置上方（使用 `view.coordsAtPos()`）
   - 节点外时移除 tooltip
2. KaTeX 渲染错误时捕获异常，tooltip 内显示错误信息
3. 在 `MarkdownEditor.vue` 注册该插件

**关键代码位置**

- `src/components/Editor/core/plugins/math-preview.ts` — 新建
- `src/components/Editor/MarkdownEditor.vue` — 注册插件

**验收条件**

- [ ] 光标移入行内公式，公式上方出现渲染后的数学符号预览
- [ ] 光标移出公式，气泡消失
- [ ] 公式语法错误时，气泡显示红色错误文字
- [ ] 气泡不遮挡正在编辑的文字

---

### T11 命令面板

**优先级**: 🟢 低

**背景**

功能越来越多，键盘导向的用户希望有一个统一的快速操作入口，类似 VS Code 的 Cmd+P。

**目标**

- Cmd+P 打开命令面板（全局搜索框）
- 支持两类搜索：`>` 前缀搜索命令（加粗、导出、设置等），无前缀搜索文件
- 键盘方向键选择，Enter 执行

**实现方案**

1. 新建 `src/components/CommandPalette.vue`
   - 全屏遮罩 + 居中搜索框
   - 输入框监听，根据是否有 `>` 前缀决定搜索模式
   - 命令列表：静态定义，每条命令含 `label`, `shortcut`, `action` 回调
   - 文件列表：调用 `list_directory` 或维护已知文件路径列表
2. `src/App.vue` 绑定 Cmd+P，控制面板显隐
3. Esc 关闭

**关键代码位置**

- `src/components/CommandPalette.vue` — 新建
- `src/App.vue` — 快捷键绑定，提供命令列表和文件列表

**验收条件**

- [ ] Cmd+P 打开命令面板
- [ ] 输入"保存"，出现"保存文件"命令，Enter 执行
- [ ] 无 `>` 前缀时，搜索当前文件夹内的 .md 文件
- [ ] 选择文件后，在当前 Tab 或新 Tab 打开
- [ ] Esc 关闭，不执行任何操作

---

### T12 文件树操作增强

**优先级**: 🟢 低

**背景**

当前文件树只支持点击打开文件，缺少基本的文件管理操作（重命名、删除、新建）。用户需要在系统 Finder 中操作后手动刷新。

**目标**

- 文件树右键菜单：新建文件、重命名、删除、在 Finder 中显示
- 支持文件树手动刷新（或监听文件系统变化自动刷新）
- 新建文件后自动在编辑器中打开并聚焦文件名进行重命名

**实现方案**

1. `src-tauri/src/lib.rs` 新增命令：
   - `create_file(dir: String, name: String) -> String` — 创建文件，返回路径
   - `rename_file(old_path: String, new_path: String)` — 重命名/移动
   - `delete_file(path: String)` — 删除文件（移到系统回收站，用 `trash` crate）
   - `reveal_in_finder(path: String)` — 在 Finder 中显示（用 `plugin-opener`）
2. `src/components/Sidebar.vue` 文件列表项增加右键菜单（自定义 context menu 组件）
3. 右键"重命名"：文件名变为可编辑 input，Enter 确认，Esc 取消
4. 删除时弹出 Tauri 确认对话框

**关键代码位置**

- `src-tauri/src/lib.rs` — 新增文件操作命令
- `src/components/Sidebar.vue` — 右键菜单交互
- `src/App.vue` — 操作后刷新文件树

**验收条件**

- [ ] 右键文件出现上下文菜单
- [ ] "新建文件"在当前目录创建 `.md` 文件，立即可重命名
- [ ] "重命名"将文件名变为输入框，Enter 确认并更新文件树
- [ ] "删除"弹出确认框，确认后文件移入回收站
- [ ] "在 Finder 中显示"打开 Finder 并选中该文件
- [ ] 操作后文件树自动刷新

---

## 开发原则

1. **每次只做一个任务**，完成验收条件后再开始下一个
2. **优先修 bug，再加功能**，遇到现有功能的 bug 先记录再集中处理
3. **不过度设计**，验收条件满足即可，不要为了"未来扩展"增加不必要的抽象
4. **类型安全**，每次开发完用 `npx vue-tsc --noEmit` 验证，不能引入新的 TS 错误
5. **保持测试**，手动验证验收条件中的每一条后再提交

---

*最后更新: 2026-02-27*
