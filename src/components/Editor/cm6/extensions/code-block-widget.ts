import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';

type HljsLike = {
  getLanguage: (lang: string) => unknown;
  highlight: (code: string, options: { language: string; ignoreIllegals?: boolean }) => { value: string };
  highlightAuto: (code: string) => { value: string };
};

let hljsPromise: Promise<HljsLike> | null = null;
function getHljs(): Promise<HljsLike> {
  if (!hljsPromise) {
    hljsPromise = import('highlight.js/lib/common').then((mod) => mod.default as HljsLike);
  }
  return hljsPromise;
}

/** 语言标签 widget（开启围栏行的可见内容） */
class FenceLangBadge extends WidgetType {
  constructor(private readonly lang: string) { super(); }

  eq(other: FenceLangBadge) { return this.lang === other.lang; }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'mk-codeblock-lang-text';
    span.textContent = this.lang || 'code';
    return span;
  }
}

/** 非活动代码块渲染 widget（语法高亮） */
class CodeBlockRenderWidget extends WidgetType {
  constructor(
    private readonly code: string,
    private readonly lang: string
  ) {
    super();
  }

  eq(other: CodeBlockRenderWidget) {
    return this.code === other.code && this.lang === other.lang;
  }

  private escapeHtml(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'mk-codeblock-render';

    const pre = document.createElement('pre');
    pre.className = 'mk-codeblock-render-pre';
    const codeEl = document.createElement('code');
    codeEl.className = `hljs${this.lang ? ` language-${this.lang}` : ''}`;
    codeEl.innerHTML = this.code ? this.escapeHtml(this.code) : '';

    if (this.code) {
      void getHljs()
        .then((hljs) => {
          try {
            const html =
              this.lang && hljs.getLanguage(this.lang)
                ? hljs.highlight(this.code, { language: this.lang, ignoreIllegals: true }).value
                : hljs.highlightAuto(this.code).value;
            codeEl.innerHTML = html;
          } catch {
            codeEl.innerHTML = this.escapeHtml(this.code);
          }
        })
        .catch(() => {
          codeEl.innerHTML = this.escapeHtml(this.code);
        });
    }

    pre.appendChild(codeEl);
    wrap.appendChild(pre);
    return wrap;
  }
}

function getActiveLines(state: EditorState) {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number;
    const toLine = state.doc.lineAt(range.to).number;
    for (let n = fromLine; n <= toLine; n++) lines.add(n);
  }
  return lines;
}

function buildDecorations(state: EditorState): DecorationSet {
  try {
    return _buildDecorations(state);
  } catch (e) {
    console.error('[code-block-widget] buildDecorations failed:', e);
    return Decoration.none;
  }
}

function _buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const activeLines = getActiveLines(state);
  const doc = state.doc;

  type OpenBlock = {
    openFrom: number;
    openTo: number;
    openNo: number;
    lang: string;
    contentStartNo: number;
  };

  let lineNo = 1;
  let open: OpenBlock | null = null;

  while (lineNo <= doc.lines) {
    const line = doc.line(lineNo);
    const fence = line.text.match(/^```([a-zA-Z0-9_-]+)?\s*$/);

    if (fence) {
      if (!open) {
        const lang = (fence[1] || '').toLowerCase();
        // mermaid/flow/seq 由独立 widget 处理
        if (!['mermaid', 'flow', 'seq'].includes(lang)) {
          open = {
            openFrom: line.from,
            openTo: line.to,
            openNo: lineNo,
            lang,
            contentStartNo: lineNo + 1,
          };
        }
      } else {
        const closeLine = line;
        const closeNo = lineNo;

        const blockActive = (() => {
          for (let n = open.openNo; n <= closeNo; n++) {
            if (activeLines.has(n)) return true;
          }
          return false;
        })();

        if (blockActive) {
          // 活动状态：源码可编辑，仅加容器线条样式
          builder.add(open.openFrom, open.openFrom, Decoration.line({ class: 'mk-codeblock-fence-open' }));
          for (let n = open.contentStartNo; n < closeNo; n++) {
            const l = doc.line(n);
            builder.add(l.from, l.from, Decoration.line({ class: 'mk-codeblock-content-line' }));
          }
          builder.add(closeLine.from, closeLine.from, Decoration.line({ class: 'mk-codeblock-fence-close' }));
        } else {
          // 非活动状态：替换为高亮渲染
          // 先收集代码文本（不能在循环内边 add 边收集，否则 widgetPos < lastContentLine.from 导致排序错误）
          const parts: string[] = [];
          for (let n = open.contentStartNo; n < closeNo; n++) {
            parts.push(doc.line(n).text);
          }
          const code = parts.join('\n');

          // header 行：line deco + badge replace
          builder.add(open.openFrom, open.openFrom, Decoration.line({ class: 'mk-codeblock-fence-open' }));
          builder.add(open.openFrom, open.openTo, Decoration.replace({ widget: new FenceLangBadge(open.lang) }));

          // 渲染 widget 放在 openTo（header 行末尾），side:1 → 渲染在 header 行之后（内容行之前）
          // 位置严格大于 openFrom，严格小于 firstContentLine.from，不会与任何 replace 冲突
          builder.add(open.openTo, open.openTo, Decoration.widget({
            widget: new CodeBlockRenderWidget(code, open.lang),
            block: true,
            side: 1,
          }));

          // 内容行全部隐藏（位置严格递增）
          for (let n = open.contentStartNo; n < closeNo; n++) {
            const l = doc.line(n);
            builder.add(l.from, l.to, Decoration.replace({}));
          }

          // footer 行
          builder.add(closeLine.from, closeLine.from, Decoration.line({ class: 'mk-codeblock-fence-close' }));
          builder.add(closeLine.from, closeLine.to, Decoration.replace({}));
        }

        open = null;
      }
    }

    lineNo++;
  }

  return builder.finish();
}

const codeBlockField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(oldDecos, tr) {
    if (tr.docChanged || tr.selection) {
      return buildDecorations(tr.state);
    }
    return oldDecos;
  },
  provide: f => EditorView.decorations.from(f),
});

export const codeBlockWidgetExtension = [
  codeBlockField,
  EditorView.baseTheme({
    // 开启围栏行：header 栏样式，直接作用于 .cm-line
    '.mk-codeblock-fence-open': {
      backgroundColor: 'var(--sidebar-bg)',
      border: '1px solid var(--border-color)',
      borderBottom: '1px solid var(--border-color)',
      borderRadius: '8px 8px 0 0',
      color: '#6b7280',
      fontSize: '11px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      marginTop: '8px',
      padding: '5px 10px',
    },
    // 语言标签文字（widget 内容）
    '.mk-codeblock-lang-text': {
      fontSize: '11px',
      textTransform: 'lowercase',
    },
    // 代码内容行：灰底 + 等宽字体 + 左右边框
    '.mk-codeblock-content-line': {
      backgroundColor: 'var(--sidebar-bg)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '13px',
      borderLeft: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      paddingLeft: '10px',
      paddingRight: '10px',
    },
    '.mk-codeblock-render': {
      backgroundColor: 'var(--sidebar-bg)',
      borderLeft: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      padding: '6px 10px',
      overflowX: 'auto',
    },
    '.mk-codeblock-render-pre': {
      margin: '0',
      whiteSpace: 'pre',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '13px',
      lineHeight: '1.6',
      background: 'transparent',
    },
    '.mk-codeblock-render-pre code': {
      background: 'transparent',
      padding: '0',
      borderRadius: '0',
    },
    // 关闭围栏行：footer 样式（左下右边框 + 圆角），内容隐藏后高度由 padding 撑开
    '.mk-codeblock-fence-close': {
      backgroundColor: 'var(--sidebar-bg)',
      borderLeft: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      borderBottom: '1px solid var(--border-color)',
      borderRadius: '0 0 8px 8px',
      padding: '4px 0',
      marginBottom: '8px',
    },
  }),
];
