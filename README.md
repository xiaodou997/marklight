<p align="center">
  <img src="./public/icon.png" width="160" alt="MarkLight Logo" />
</p>

<h1 align="center">墨光 (MarkLight)</h1>

<p align="center">
  <strong>一款基于 Tauri 2.0 与 CodeMirror 6 Live Preview 的高性能、本地优先 Markdown 编辑器</strong>
</p>

<p align="center">
  <a href="https://github.com/xiaodou997/marklight/releases">
    <img src="https://img.shields.io/github/v/release/xiaodou997/marklight?style=flat-square&color=blue" alt="Version" />
  </a>
  <a href="https://gitee.com/xiaodou997/marklight">
    <img src="https://img.shields.io/badge/Gitee-xiaodou997-red?style=flat-square&logo=gitee" alt="Gitee" />
  </a>
  <a href="https://github.com/xiaodou997/marklight/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-Apache--2.0-green?style=flat-square" alt="Apache-2.0" />
  </a>
</p>

---

## ✨ 核心特性

- **🚀 实时渲染编辑**：基于 CodeMirror 6 Live Preview，源码与渲染无缝切换，输入即是最终形态。
- **📦 本地优先**：图片自动本地化存储至 `assets/` 目录，支持拖拽与剪贴板粘贴。
- **🎯 专注模式**：沉浸式焦点写作模式，隐藏所有干扰，只留思考空间。
- **⌨️ 效率专家**：全功能命令面板 (`Cmd+K`)，支持快速跳转文件与执行编辑指令。
- **📊 专业渲染**：内置 KaTeX 数学公式（实时预览气泡）与 Mermaid 工业级图表支持。
- **📱 微信排版**：内置多套精美微信排版主题，一键导出带行内样式的 HTML。
- **🖥️ 跨平台一致性**：为 Windows/macOS 提供深度优化的原生体验，支持多窗口独立编辑。

## 🛠️ 技术选型

| 模块 | 技术方案 |
| :--- | :--- |
| **桌面框架** | [Tauri 2.0](https://tauri.app/) (Rust + Webview2/WebKit) |
| **编辑器内核** | [CodeMirror 6](https://codemirror.net/)（默认） + ProseMirror（兼容回退） |
| **前端框架** | Vue 3 (Composition API) + TypeScript |
| **样式方案** | Tailwind CSS 4.0 |
| **数据管理** | Pinia + 文件系统实时监听 (notify) |

## 🚀 快速开始

### 运行开发环境
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev:tauri
```

### 构建安装包
```bash
# 生成对应平台的安装程序 (.dmg / .exe)
pnpm build:tauri
```

## 📈 增长轨迹

[![GitHub Star History Chart](https://api.star-history.com/svg?repos=xiaodou997/marklight&type=Date)](https://star-history.com/#xiaodou997/marklight&Date)

## 🤝 贡献与反馈

墨光 (MarkLight) 仍处于快速进化中，欢迎你的反馈和建议！

- 💡 **功能建议**：欢迎提交 [Issue](https://github.com/xiaodou997/marklight/issues)
- 🐛 **Bug 报告**：请提交 [Issue](https://github.com/xiaodou997/marklight/issues)

## 📄 开源协议

本项目基于 [Apache License 2.0](LICENSE) 协议开源。

这意味着你可以：
- ✅ 商业使用
- ✅ 修改代码
- ✅ 分发副本
- ✅ 专利授权

唯一要求是保留原始的版权声明和许可证副本。

---
<p align="center">
  <b>墨光 (MarkLight) - 记录思考，从轻开始。</b><br/>
  <i>Developed by luoxiaodou</i>
</p>
