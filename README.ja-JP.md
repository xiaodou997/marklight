<p align="center">
  <img src="./public/icon.png" width="160" alt="MarkLight Logo" />
</p>

<h1 align="center">MarkLight</h1>

<p align="center">
  <strong>Tauri 2、Rust ドメインコア、TipTap で構築されたローカルファーストの Markdown エディター</strong>
</p>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <a href="./README.ja-JP.md">日本語</a>
  ·
  <a href="./README.ko-KR.md">한국어</a>
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

## 主な機能

- WYSIWYG 編集：TipTap / ProseMirror をベースに、コードブロック、テーブル、数式、Mermaid、Callout などをレンダリング状態のまま編集できます。
- ローカルファースト：文書、画像、ワークスペースはすべてローカルで管理されます。ドロップした画像は現在の文書と同じ階層の `assets/` に保存されます。
- デスクトップらしい操作感：複数ウィンドウでの編集、ウィンドウ状態の永続化、ネイティブメニュー、システム印刷に対応しています。
- 構造化されたワークスペース：Rust がディレクトリフィルタリング、watcher の集約、外部変更イベント、保存競合の検出を担います。
- WeChat / HTML エクスポート：フロントエンドがエクスポート用コンテンツをレンダリングし、ネイティブ側が印刷とファイル書き込みを処理します。

## アーキテクチャ

MarkLight は明確な 3 層構造を採用しています。

- Vue 3 + Pinia + TipTap：UI、エディター体験、コマンドディスパッチを担当します。
- Tauri 2：プラグイン、権限境界、コマンド / イベントブリッジを担当します。
- Rust ドメインコア：文書、ワークスペース、ウィンドウランタイム、watcher の一貫性を担当します。

プロジェクト上の制約：

- フロントエンドのビジネスロジックから `invoke` / `listen` / `emit` を直接呼び出しません。
- 公開 Rust コマンドは構造化 DTO と `AppError` を返します。
- 汎用的なデスクトップ機能は、まず公式 Tauri プラグインの利用を優先します。

詳しいドキュメント：

- [ドキュメント索引](./docs/README.md)
- [アーキテクチャ](./docs/ARCHITECTURE.md)
- [エンジニアリング標準](./docs/ENGINEERING_STANDARDS.md)
- [ロードマップ](./docs/ROADMAP.md)
- [変更履歴](./docs/CHANGELOG.md)

## 技術スタック

- デスクトップフレームワーク：Tauri 2
- ネイティブコア：Rust
- フロントエンド：Vue 3 + TypeScript + Pinia + Vite
- エディター：TipTap / ProseMirror
- Markdown：markdown-it + カスタム parser / serializer
- スタイル：Tailwind CSS
- ネイティブプラグイン：store / window-state / dialog / opener / cli

## 開発

```bash
bun install
bun run dev
bun run dev:tauri
bun run build
bun run build:tauri
bun run lint
bun run format
bunx vue-tsc --noEmit
bun run test
cargo check --manifest-path src-tauri/Cargo.toml
```

## 現在のアーキテクチャ上の要点

- 文書保存時の競合検出は Rust の `save_document` に集約されています。
- ワークスペース watcher イベントは `workspace-changed` に正規化されています。
- 起動時オープン、システムからのオープン、複数ウィンドウの保留オープン要求は、共通の `app-open-paths` payload モデルを使います。
- `App.vue` は合成レイヤーに徹し、文書、ワークスペース、ウィンドウのライフサイクルは専用の session composable に分離されています。

## コントリビュート

- Issue と Pull Request は GitHub で歓迎します。
- アーキテクチャや責務境界を変更する前に、`docs/ARCHITECTURE.md` と `docs/ENGINEERING_STANDARDS.md` を読んでください。
- 新しい機能を追加する場合は、既存のプラグインやドメインモジュールで扱えない理由を先に明確にしてください。

## License

MarkLight は [Apache License 2.0](LICENSE) のもとで公開されています。
