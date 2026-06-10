<p align="center">
  <img src="./public/icon.png" width="160" alt="MarkLight Logo" />
</p>

<h1 align="center">MarkLight</h1>

<p align="center">
  <strong>Tauri 2, Rust 도메인 코어, TipTap으로 만든 로컬 우선 Markdown 에디터</strong>
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

## 주요 기능

- WYSIWYG 편집: TipTap / ProseMirror 기반으로 코드 블록, 표, 수식, Mermaid, Callout 등을 렌더링된 상태에서 편집할 수 있습니다.
- 로컬 우선 워크플로: 문서, 이미지, 워크스페이스가 모두 로컬에서 관리됩니다. 드롭한 이미지는 현재 문서 옆의 `assets/` 폴더에 저장됩니다.
- 데스크톱 네이티브 경험: 다중 창 편집, 창 상태 저장, 네이티브 메뉴, 시스템 인쇄를 지원합니다.
- 구조화된 워크스페이스: Rust가 디렉터리 필터링, watcher 집계, 외부 변경 이벤트, 저장 충돌 감지를 담당합니다.
- WeChat 및 HTML 내보내기: 프론트엔드가 내보내기용 콘텐츠를 렌더링하고, 네이티브 계층이 인쇄와 파일 쓰기를 처리합니다.

## 아키텍처

MarkLight는 명확한 세 계층으로 구성됩니다.

- Vue 3 + Pinia + TipTap: UI, 에디터 상호작용, 명령 디스패치를 담당합니다.
- Tauri 2: 플러그인, 권한 경계, 명령 / 이벤트 브리지를 담당합니다.
- Rust 도메인 코어: 문서, 워크스페이스, 창 런타임, watcher 일관성을 담당합니다.

프로젝트 제약:

- 프론트엔드 비즈니스 로직에서 `invoke`, `listen`, `emit`을 직접 호출하지 않습니다.
- 공개 Rust 명령은 구조화된 DTO와 `AppError`를 반환합니다.
- 일반적인 데스크톱 기능은 먼저 공식 Tauri 플러그인 사용을 우선합니다.

자세한 문서:

- [문서 인덱스](./docs/README.md)
- [아키텍처](./docs/ARCHITECTURE.md)
- [엔지니어링 표준](./docs/ENGINEERING_STANDARDS.md)
- [로드맵](./docs/ROADMAP.md)
- [변경 내역](./docs/CHANGELOG.md)

## 기술 스택

- 데스크톱 프레임워크: Tauri 2
- 네이티브 코어: Rust
- 프론트엔드: Vue 3 + TypeScript + Pinia + Vite
- 에디터: TipTap / ProseMirror
- Markdown: markdown-it + 커스텀 parser / serializer
- 스타일링: Tailwind CSS
- 네이티브 플러그인: store / window-state / dialog / opener / cli

## 개발

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

## 현재 아키텍처 메모

- 저장 충돌 감지는 Rust `save_document`에 중앙화되어 있습니다.
- 워크스페이스 watcher 이벤트는 `workspace-changed`로 정규화됩니다.
- 시작 시 열기, 시스템에서 열기, 다중 창의 대기 중인 열기 요청은 공통 `app-open-paths` payload 모델을 사용합니다.
- `App.vue`는 조합 계층에 집중하며, 문서, 워크스페이스, 창 라이프사이클은 전용 session composable로 분리되어 있습니다.

## 기여

- Issue와 Pull Request는 GitHub에서 환영합니다.
- 아키텍처나 소유 경계를 변경하기 전에 `docs/ARCHITECTURE.md`와 `docs/ENGINEERING_STANDARDS.md`를 읽어 주세요.
- 새 기능을 추가할 때는 기존 플러그인이나 도메인 모듈로 처리할 수 없는 이유를 먼저 명확히 해 주세요.

## License

MarkLight는 [Apache License 2.0](LICENSE)에 따라 오픈소스로 공개됩니다.
