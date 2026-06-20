# AGENTS.md

## Project snapshot

- MarkLight is a Tauri 2 desktop Markdown editor.
- Frontend lives in `src/` and is built with Vue 3, Pinia, Vite, TypeScript, and Tailwind.
- Desktop/native code lives in `src-tauri/` and exposes filesystem, config, watcher, window, image, and print commands to the frontend.
- The editor core is TipTap/ProseMirror with a custom Markdown parser and serializer in `src/components/Editor/tiptap/markdown/`.

## Essential commands

### Frontend and app

```bash
bun install
bun run dev
bun run dev:tauri
bun run build
bun run build:tauri
bun run preview
bun run lint
bun run lint:fix
bun run format
```

### Tests

Vitest is configured in `vitest.config.ts`.
Run tests with:

```bash
bun run test
```

## What lives where

### Frontend shell

- `src/App.vue` is the orchestration layer. It wires stores, menu events, window events, file operations, file tree state, export actions, focus mode, command palette, and the editor/image/source-mode switch.
- `src/main.ts` is minimal bootstrapping only.

### State and cross-cutting logic

- `src/stores/file.ts` owns the current document path/content/dirty state and last modified timestamp.
- `src/stores/settings.ts` owns app settings, theme selection, config migration, focus mode, and debounced persistence.
- `src/composables/` contains most app behavior that is not editor-schema specific: file open/save, file tree/watchers, export, image preview, menu/window integration.

### Editor

- `src/components/Editor/MarkdownEditor.vue` creates the TipTap editor, registers all custom extensions, debounces serialization back into the file store, emits outline/cursor/word-count updates, and owns editor-local search/replace and image drag-drop handling.
- `src/components/Editor/tiptap/extensions/` holds the custom TipTap extensions. Complex rendering is implemented inline with `addNodeView()` in the extension files rather than split into separate Vue files.
- `src/components/Editor/tiptap/markdown/parser.ts` converts Markdown into a ProseMirror document.
- `src/components/Editor/tiptap/markdown/serializer.ts` converts the ProseMirror document back to Markdown.
- `src/components/Editor/tiptap/markdown/__tests__/roundtrip.spec.ts` is the main automated safety net for Markdown fidelity.

### Themes and export

- `src/themes/` contains the app theme system. Preset themes are JSON files under `src/themes/presets/`.
- `src/utils/wechat-renderer.ts` is a separate Markdown-to-HTML export path for WeChat copy/export. It does not go through the ProseMirror document tree.

### Native layer

- `src-tauri/src/lib.rs` registers commands, menu wiring, file watcher setup, startup file-open handling, and window-close interception.
- `src-tauri/src/commands/fs.rs` contains the file operations exposed to the frontend.
- `src-tauri/src/commands/watch.rs` wraps the shared `notify` watcher.
- `src-tauri/src/commands/config.rs` persists settings to the app config directory as `settings.json`.
- `src-tauri/src/menu.rs` defines native menu items and emits string event ids back to the frontend.

## Architecture and data flow

### Document flow

1. Markdown is loaded from the Rust command layer.
2. `parseMarkdown()` turns it into a ProseMirror document.
3. TipTap renders and edits that document.
4. `serializeMarkdown()` is called on debounced editor updates.
5. The serialized Markdown is written back into the file store and later saved via Rust commands.

### App flow

- `App.vue` treats the editor as one view mode among editor/image/source views.
- Sidebar outline data is emitted upward from `MarkdownEditor.vue`.
- File tree state is independent from current document state and is refreshed from native watcher events.
- Native menu actions are emitted from Rust as string ids and mapped back to handlers in the frontend.

## Non-obvious conventions and gotchas

### Dirty-state handling is intentional

- `src/stores/file.ts` separates `setContent()` from `markUserEdit()`.
- `setContent()` only marks the document dirty after `hasUserEdit` has been set.
- This is important because the editor writes normalized content back into the store programmatically.
- If you change document sync behavior, preserve this distinction or you will reintroduce false dirty states.

### The editor establishes a normalized baseline on load

- In `MarkdownEditor.vue`, after parsing and `setContent()`, the code immediately serializes the ProseMirror document and pushes that baseline back into the file store.
- This avoids dirty-state flicker caused by parser/serializer normalization differences.
- Do not remove this unless you also redesign dirty detection.

### The serializer always normalizes the trailing newline

- `serializeMarkdown()` forces output to end with exactly one trailing newline.
- Round-trip tests normalize expected output the same way.
- If a change appears to add a newline unexpectedly, check the serializer before changing tests.

### Markdown support is split across preprocessors and schema handlers

- `parser.ts` does more than raw `markdown-it` token mapping.
- Frontmatter, callouts, and `$$...$$` math blocks are extracted before `markdown-it` runs and restored from placeholder comments afterward.
- Wikilinks are recognized from plain text tokens.
- If you add a Markdown feature, update both parse and serialize paths, then extend round-trip tests.

### Mark ordering can change during round-trip

- The tests already document ProseMirror mark normalization.
- Example: some nested mark combinations serialize in schema order rather than the original textual order.
- Do not “fix” those test expectations unless the schema/mark behavior itself changes.

### File tree is intentionally filtered

- `list_directory()` in `src-tauri/src/commands/fs.rs` only returns directories plus:
  - Markdown files: `md`, `markdown`
  - Text files: `txt`
  - Images: `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`
- If a file type is “missing” from the sidebar, this Rust filter is usually why.

### External file watching only refreshes the tree

- The native watcher in `src-tauri/src/lib.rs` emits debounced `file-changed` events.
- `useFileTree.ts` listens for those and refreshes the folder tree when the changed path is inside the current root folder.
- That path does not auto-reload the open document content.
- Save conflict detection is handled separately with last-modified timestamps in `useFileOperations.ts`.

### Drag and drop is split in two places

- `App.vue` handles app-level file drops and opens the first dropped Markdown/text file.
- `MarkdownEditor.vue` handles dropped image files and saves them through the native `save_image` command.
- Image drop requires a current saved document path because the image is stored relative to the document.

### Settings persistence has two backends on purpose

- Main settings are stored in the native config file via `read_config` and `write_config`.
- Focus mode still uses `localStorage` under `marklight-focus-mode`.
- There is also one-time migration logic from legacy `localStorage` settings into the config file.

### Theme application is CSS-variable driven

- `src/themes/manager.ts` injects theme variables into the document and also maintains a dedicated `<style>` tag for theme preview/live updates.
- `MarkdownEditor.vue` separately injects `settings.customEditorCSS` into its own style tag.
- If styling changes seem to “ignore” component CSS, inspect these injected variables/styles first.

### Startup file-open behavior is race-sensitive

- `src-tauri/src/lib.rs` uses `StartupOpenFile`, `consume_startup_open_file`, and `notify_frontend_ready()` to avoid losing file-open events during startup.
- This is especially relevant for macOS open-with flows and window lifecycle changes.
- Be careful when touching startup event order.

## Testing guidance

- Current automated coverage is narrow and focused on Markdown round-trip behavior.
- `vitest.config.ts` uses the `node` environment and only includes `src/**/__tests__/**/*.spec.ts`.
- The existing tests construct a minimal schema instead of booting the full editor, so parser/serializer changes are cheap to validate.
- If you touch Markdown syntax handling, token nodes, heading markers, or serialization rules, add or update round-trip cases first.

## Style and formatting

### Prettier

From `.prettierrc`:

- semicolons enabled
- single quotes enabled
- trailing commas enabled
- 2-space indentation
- print width 100
- LF line endings

### ESLint

Observed rules in `eslint.config.js`:

- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-unused-vars`: warn, but `_`-prefixed args are ignored
- `no-console`: warn, but `console.warn` and `console.error` are allowed
- several Vue formatting rules are disabled

When touching TS/Vue/CSS files, prefer the Prettier style even though some scaffolded files still use older formatting.

## Release and CI notes

- `.github/workflows/build.yml` builds releases only on tag pushes matching `v*`.
- The release matrix currently targets:
  - macOS arm64
  - macOS x64
  - Windows x64
- That workflow generates release notes by grouping commit subjects with conventional prefixes like `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `style:`, `chore:`.
- `.github/workflows/sync-to-gitee.yml` force-pushes `main` and tags to Gitee, after removing that workflow file from the mirrored copy.

## Good starting points for common work

- Editor behavior bug: start in `src/components/Editor/MarkdownEditor.vue` and the matching TipTap extension.
- Markdown fidelity bug: inspect `parser.ts`, `serializer.ts`, then `roundtrip.spec.ts`.
- File tree or file open/save bug: inspect `useFileTree.ts`, `useFileOperations.ts`, and `src-tauri/src/commands/fs.rs`.
- Theme or appearance issue: inspect `src/stores/settings.ts`, `src/themes/manager.ts`, and `src/assets/styles/main.css`.
- Menu/window behavior: inspect `src-tauri/src/menu.rs`, `useMenuEvents.ts`, and `useWindowEvents.ts`.
