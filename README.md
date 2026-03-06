<p align="center">
  <img src="./public/icon.png" width="160" alt="MarkLight Logo" />
</p>

<h1 align="center">MarkLight</h1>

<p align="center">
  <strong>一款基于 Tauri 2.0 与 ProseMirror 的高性能、自研内核 Markdown 编辑器</strong>
</p>

<p align="center">
  <a href="https://github.com/xiaodou997/marklight/releases">
    <img src="https://img.shields.io/github/v/release/xiaodou997/marklight?style=flat-square&color=blue" alt="Version" />
  </a>
  <a href="https://github.com/xiaodou997/marklight/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/xiaodou997/marklight?style=flat-square&color=yellow" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/Tauri-2.0-blue?style=flat-square&logo=tauri" alt="Tauri" />
  <img src="https://img.shields.io/badge/Vue-3.5-green?style=flat-square&logo=vue.js" alt="Vue" />
  <img src="https://img.shields.io/badge/pnpm-10-orange?style=flat-square&logo=pnpm" alt="pnpm" />
</p>

---

## ✨ 核心特性

- **🚀 所见即所得**：基于 ProseMirror 自研内核，告别分栏预览，输入即是最终形态。
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
| **编辑器内核** | [ProseMirror](https://prosemirror.net/) (自定义 Schema & 插件) |
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

MarkLight 仍处于快速进化中，欢迎提交 [Issue](https://github.com/xiaodou997/marklight/issues) 或 Pull Request。

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 协议开源。

---
<p align="center">
  <b>MarkLight - 记录思考，从轻开始。</b>
</p>
