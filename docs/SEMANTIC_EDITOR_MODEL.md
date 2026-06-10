# Semantic Editor Model

This branch moves MarkLight toward a semantic ProseMirror document model.

## Core Invariant

The editor document must contain only semantic content:

- block nodes such as `heading`, `paragraph`, `blockquote`, `codeBlock`, `table`, and `callout`
- inline content such as text, marks, images, math, wikilinks, and hard breaks
- attributes required to serialize the document back to Markdown

Markdown syntax tokens such as `#`, `**`, `_`, `[`, `]`, and `(url)` must not be stored as
ProseMirror nodes.

## Why

Inline atom token nodes create unstable editing boundaries. They interfere with IME composition,
selection mapping, undo/redo, copy/paste, and mark boundary editing. The most visible symptom was
Chinese IME text splitting across a heading and a following paragraph after typing `# `.

## Rendering Markdown Syntax

Markdown syntax can still be shown in the editor, but only as view-only presentation:

- CSS pseudo-elements
- ProseMirror decorations
- popovers or menus for editable metadata such as link URLs

View-only syntax must not participate in document positions or serialization.

## Current Cut

- Headings use StarterKit's semantic `heading` node.
- Markdown heading shortcuts are delayed: `# ` remains a pending paragraph while IME
  composition is active and converts to `heading` only after real body text exists and IME
  DOM updates have settled.
- Heading gutter labels are rendered with CSS `::before`.
- `headingMarker`, mark token nodes, and link token nodes were removed from the editor runtime.
- Parser, serializer, export tree, and compatibility schema now operate on semantic heading content.

## Follow-up Work

- Add selection-scoped decorations for optional Markdown mark hints.
- Replace inline link URL token editing with a focused popover or bubble menu flow.
- Expand manual QA across macOS Pinyin, Windows Microsoft Pinyin, Japanese IME, and Korean IME.
