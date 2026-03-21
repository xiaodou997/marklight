import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';
import type mermaidType from 'mermaid';

let mermaidLoader: Promise<typeof mermaidType> | null = null;
function loadMermaid() {
  if (!mermaidLoader) {
    mermaidLoader = import('mermaid').then(mod => mod.default);
  }
  return mermaidLoader;
}

let mermaidInited = false;
async function ensureMermaidInit() {
  const mermaid = await loadMermaid();
  if (!mermaidInited) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
    });
    mermaidInited = true;
  }
  return mermaid;
}

function convertFlowToMermaid(raw: string): string {
  const lines = raw.trim().split('\n');
  const nodes: Record<string, { type: string; text: string }> = {};
  const connections: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const nodeDef = trimmed.match(/^(\w+)=>(\w+):\s*(.*)$/);
    if (nodeDef) {
      nodes[nodeDef[1]] = { type: nodeDef[2], text: nodeDef[3] };
      continue;
    }

    const parts = trimmed.split('->');
    for (let i = 0; i < parts.length - 1; i++) {
      const fromMatch = parts[i].match(/^(\w+)(?:\(([^)]*)\))?$/);
      const toMatch = parts[i + 1].match(/^(\w+)(?:\(([^)]*)\))?$/);
      if (fromMatch && toMatch) {
        const label = fromMatch[2] || '';
        connections.push(label
          ? `    ${fromMatch[1]} -->|${label}| ${toMatch[1]}`
          : `    ${fromMatch[1]} --> ${toMatch[1]}`
        );
      }
    }
  }

  const shapeMap: Record<string, (id: string, text: string) => string> = {
    start: (id, text) => `    ${id}([${text}])`,
    end: (id, text) => `    ${id}([${text || 'End'}])`,
    operation: (id, text) => `    ${id}[${text}]`,
    condition: (id, text) => `    ${id}{${text}}`,
    subroutine: (id, text) => `    ${id}[[${text}]]`,
    inputoutput: (id, text) => `    ${id}[/${text}/]`,
  };

  const nodeLines = Object.entries(nodes).map(([id, { type, text }]) => {
    const fn = shapeMap[type] || shapeMap.operation;
    return fn(id, text);
  });

  return `flowchart TD\n${nodeLines.join('\n')}\n${connections.join('\n')}`;
}

function convertSeqToMermaid(raw: string): string {
  const lines = raw.trim().split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (/^Note\s/i.test(trimmed)) return `    ${trimmed}`;
    return `    ${trimmed.replace(/-->/g, '__ARROW__').replace(/->/g, '->>').replace(/__ARROW__/g, '-->>')}`;
  });
  return `sequenceDiagram\n${lines.join('\n')}`;
}

class MermaidWidget extends WidgetType {
  constructor(
    private readonly code: string,
    private readonly lang: string
  ) {
    super();
  }

  eq(other: MermaidWidget) {
    return this.code === other.code && this.lang === other.lang;
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'mk-mermaid-widget';

    const badge = document.createElement('div');
    badge.className = 'mk-mermaid-badge';
    badge.textContent = this.lang || 'mermaid';
    wrap.appendChild(badge);

    const container = document.createElement('div');
    container.className = 'mk-mermaid-content';
    wrap.appendChild(container);

    const raw = this.code.trim();
    if (!raw) {
      container.textContent = '空图表';
      return wrap;
    }

    let renderCode = raw;
    if (this.lang === 'flow') renderCode = convertFlowToMermaid(raw);
    if (this.lang === 'seq') renderCode = convertSeqToMermaid(raw);

    void (async () => {
      try {
        const mermaid = await ensureMermaidInit();
        const id = `mk-mermaid-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaid.render(id, renderCode);
        container.innerHTML = svg;
      } catch (error) {
        container.textContent = `Mermaid 渲染失败: ${(error as Error)?.message ?? 'unknown error'}`;
      }
    })();

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
  const builder = new RangeSetBuilder<Decoration>();
  const activeLines = getActiveLines(state);
  const doc = state.doc;

  let line = doc.line(1);
  let open: { from: number; lineNo: number; lang: string } | null = null;
  let content: string[] = [];

  while (line.number <= doc.lines) {
    const fence = line.text.match(/^```([a-zA-Z0-9_-]+)?\s*$/);
    if (fence) {
      if (!open) {
        const lang = (fence[1] || '').toLowerCase();
        open = { from: line.from, lineNo: line.number, lang };
        content = [];
      } else {
        const closeLineNo = line.number;
        const mermaidLike = ['mermaid', 'flow', 'seq'].includes(open.lang);
        if (mermaidLike) {
          let hasActive = false;
          for (let n = open.lineNo; n <= closeLineNo; n++) {
            if (activeLines.has(n)) {
              hasActive = true;
              break;
            }
          }
          if (!hasActive) {
            builder.add(
              open.from,
              line.to,
              Decoration.replace({
                widget: new MermaidWidget(content.join('\n'), open.lang),
                inclusive: false,
              })
            );
          }
        }
        open = null;
        content = [];
      }
    } else if (open) {
      content.push(line.text);
    }

    if (line.number >= doc.lines) break;
    line = doc.line(line.number + 1);
  }

  return builder.finish();
}

const mermaidField = StateField.define<DecorationSet>({
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

export const mermaidWidgetExtension = [
  mermaidField,
  EditorView.baseTheme({
    '.mk-mermaid-widget': {
      margin: '10px 0',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      backgroundColor: 'var(--bg-color)',
      overflow: 'hidden',
    },
    '.mk-mermaid-badge': {
      fontSize: '11px',
      color: '#6b7280',
      padding: '6px 10px',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'var(--sidebar-bg)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      textTransform: 'lowercase',
    },
    '.mk-mermaid-content': {
      padding: '10px',
      overflowX: 'auto',
      color: '#ef4444',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '12px',
    },
  }),
];
