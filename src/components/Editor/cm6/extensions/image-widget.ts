import { RangeSetBuilder } from '@codemirror/state';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate, WidgetType } from '@codemirror/view';
import type { useFileStore } from '../../../../stores/file';

function unescapeMarkdown(value: string): string {
  return value.replace(/\\([()[\]])/g, '$1');
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : normalized;
}

function resolveImageSrc(rawSrc: string, currentFilePath?: string): string {
  if (!rawSrc) return '';
  const src = unescapeMarkdown(rawSrc);
  if (/^(https?:\/\/|data:)/i.test(src)) return src;
  if (src.startsWith('/') || /^[a-zA-Z]:/.test(src)) {
    try {
      return convertFileSrc(normalizePath(src));
    } catch {
      return src;
    }
  }
  if (!currentFilePath) return src;
  const absolute = `${getDirectory(currentFilePath)}/${normalizePath(src)}`;
  try {
    return convertFileSrc(absolute);
  } catch {
    return src;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly alt: string,
    private readonly src: string,
    private readonly currentFilePath?: string
  ) {
    super();
  }

  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'mk-image-widget';

    const img = document.createElement('img');
    img.className = 'mk-image-widget-el';
    img.alt = this.alt;
    img.src = resolveImageSrc(this.src, this.currentFilePath);
    img.loading = 'lazy';

    const caption = document.createElement('span');
    caption.className = 'mk-image-widget-caption';
    caption.textContent = this.alt || this.src;

    wrap.appendChild(img);
    wrap.appendChild(caption);
    return wrap;
  }
}

function getActiveLines(state: EditorView['state']) {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number;
    const toLine = state.doc.lineAt(range.to).number;
    for (let n = fromLine; n <= toLine; n++) lines.add(n);
  }
  return lines;
}

export function createImageWidgetExtension(fileStore: ReturnType<typeof useFileStore>) {
  function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const { state } = view;
    const activeLines = getActiveLines(state);
    const imageRe = /!\[([^\]\n]*)\]\(([^)\n]+)\)/g;

    for (const range of view.visibleRanges) {
      let line = state.doc.lineAt(range.from);
      while (line.from <= range.to) {
        if (!activeLines.has(line.number)) {
          let match: RegExpExecArray | null;
          imageRe.lastIndex = 0;
          while ((match = imageRe.exec(line.text)) !== null) {
            const fullFrom = line.from + match.index;
            const fullTo = fullFrom + match[0].length;
            const alt = unescapeMarkdown(match[1] ?? '');
            const src = match[2] ?? '';
            builder.add(
              fullFrom,
              fullTo,
              Decoration.replace({
                widget: new ImageWidget(alt, src, fileStore.currentFile.path || undefined),
                inclusive: false,
              })
            );
          }
        }

        if (line.to >= range.to) break;
        line = state.doc.line(line.number + 1);
      }
    }

    return builder.finish();
  }

  return [
    ViewPlugin.fromClass(class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    }, {
      decorations: plugin => plugin.decorations,
    }),
    EditorView.baseTheme({
      '.mk-image-widget': {
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '6px',
        margin: '8px 0',
        maxWidth: '100%',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '6px',
        backgroundColor: 'var(--bg-color)',
      },
      '.mk-image-widget-el': {
        maxWidth: '100%',
        maxHeight: '520px',
        objectFit: 'contain',
        borderRadius: '6px',
      },
      '.mk-image-widget-caption': {
        fontSize: '12px',
        color: '#6b7280',
        lineHeight: '1.3',
      },
    }),
  ];
}
