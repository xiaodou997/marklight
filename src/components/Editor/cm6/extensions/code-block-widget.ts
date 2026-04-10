import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';
import { getActiveLines } from '../utils/active-lines';

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

/**
 * 整块代码块 widget（非活动时渲染，包含 header + highlight.js 内容 + footer）
 * 用一个 Decoration.replace 替换从开启围栏到关闭围栏的整个范围，
 * 彻底消除内容行残留的行高空白。
 */
class FullCodeBlockWidget extends WidgetType {
  constructor(
    private readonly code: string,
    private readonly lang: string,
    private readonly blockFrom: number
  ) {
    super();
  }

  eq(other: FullCodeBlockWidget) {
    return this.code === other.code && this.lang === other.lang && this.blockFrom === other.blockFrom;
  }

  /** 单击不触发 cursor 移动（保持渲染），双击进入编辑模式 */
  ignoreEvent(event: Event) {
    return event.type !== 'dblclick';
  }

  private escapeHtml(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'mk-codeblock-widget';

    // ── header ──
    const header = document.createElement('div');
    header.className = 'mk-codeblock-fence-open';
    header.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const langText = document.createElement('span');
    langText.className = 'mk-codeblock-lang-text';
    langText.textContent = this.lang || 'code';
    header.appendChild(langText);

    const editBtn = document.createElement('span');
    editBtn.className = 'mk-codeblock-edit-btn';
    editBtn.title = '双击代码区域或点击此处进入编辑';
    editBtn.textContent = '✏';
    editBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const line = view.state.doc.lineAt(this.blockFrom);
      const targetLine = view.state.doc.line(line.number + 1);
      view.dispatch({ selection: { anchor: targetLine.from } });
      view.focus();
    });
    header.appendChild(editBtn);
    wrap.appendChild(header);

    // ── code content ──
    const renderDiv = document.createElement('div');
    renderDiv.className = 'mk-codeblock-render';

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
    renderDiv.appendChild(pre);
    wrap.appendChild(renderDiv);

    // ── footer ──
    const footer = document.createElement('div');
    footer.className = 'mk-codeblock-fence-close';
    wrap.appendChild(footer);

    return wrap;
  }
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
          // 活动状态：显示原始 markdown，用行级样式标记
          builder.add(open.openFrom, open.openFrom, Decoration.line({ class: 'mk-codeblock-fence-open' }));
          for (let n = open.contentStartNo; n < closeNo; n++) {
            const l = doc.line(n);
            builder.add(l.from, l.from, Decoration.line({ class: 'mk-codeblock-content-line' }));
          }
          builder.add(closeLine.from, closeLine.from, Decoration.line({ class: 'mk-codeblock-fence-close' }));
        } else {
          // 非活动状态：用单个 block replace 替换整个代码块范围
          const parts: string[] = [];
          for (let n = open.contentStartNo; n < closeNo; n++) {
            parts.push(doc.line(n).text);
          }
          const code = parts.join('\n');

          builder.add(
            open.openFrom,
            closeLine.to,
            Decoration.replace({
              widget: new FullCodeBlockWidget(code, open.lang, open.openFrom),
              block: true,
            })
          );
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

export const codeBlockWidgetExtension = codeBlockField;
