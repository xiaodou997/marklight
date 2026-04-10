import { RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet, WidgetType } from '@codemirror/view';
import { getActiveLines } from '../utils/active-lines';

class FrontmatterWidget extends WidgetType {
  constructor(private readonly yaml: string) {
    super();
  }

  eq(other: FrontmatterWidget) {
    return this.yaml === other.yaml;
  }

  ignoreEvent(event: Event) {
    // 双击进入编辑
    return event.type !== 'dblclick';
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'mk-frontmatter';

    const header = document.createElement('div');
    header.className = 'mk-frontmatter-header';
    header.textContent = '📄 frontmatter';
    wrap.appendChild(header);

    const lines = this.yaml.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = document.createElement('div');
      row.className = 'mk-frontmatter-row';

      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = document.createElement('span');
        key.className = 'mk-frontmatter-key';
        key.textContent = line.slice(0, colonIdx + 1);

        const value = document.createElement('span');
        value.className = 'mk-frontmatter-value';
        value.textContent = line.slice(colonIdx + 1);

        row.appendChild(key);
        row.appendChild(value);
      } else {
        row.textContent = line;
      }
      wrap.appendChild(row);
    }

    return wrap;
  }
}

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;
  const activeLines = getActiveLines(state);

  if (doc.lines < 2) return builder.finish();

  // 检查第1行是否为 ---
  const firstLine = doc.line(1);
  if (firstLine.text.trim() !== '---') return builder.finish();

  // 找结尾 ---
  let closeLine: ReturnType<typeof doc.line> | null = null;
  for (let n = 2; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (line.text.trim() === '---') {
      closeLine = line;
      break;
    }
    // 安全上限：frontmatter 不超过50行
    if (n > 51) break;
  }

  if (!closeLine) return builder.finish();

  // 检查 frontmatter 区域是否有活动行
  let hasActive = false;
  for (let n = firstLine.number; n <= closeLine.number; n++) {
    if (activeLines.has(n)) { hasActive = true; break; }
  }
  if (hasActive) return builder.finish();

  // 收集 YAML 内容
  const yamlLines: string[] = [];
  for (let n = 2; n < closeLine.number; n++) {
    yamlLines.push(doc.line(n).text);
  }

  builder.add(
    firstLine.from,
    closeLine.to,
    Decoration.replace({
      widget: new FrontmatterWidget(yamlLines.join('\n')),
      inclusive: false,
      block: true,
    })
  );

  return builder.finish();
}

const frontmatterField = StateField.define<DecorationSet>({
  create: buildDecorations,
  update(old, tr) {
    if (tr.docChanged || tr.selection) return buildDecorations(tr.state);
    return old;
  },
  provide: f => EditorView.decorations.from(f),
});

export const frontmatterWidgetExtension = frontmatterField;
