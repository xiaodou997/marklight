/**
 * ProseMirror Document → Markdown 序列化器
 *
 * 将 ProseMirror 文档树转换为 markdown 字符串。
 * 自定义实现以精确控制输出格式，支持 GFM 表格、任务列表等扩展语法。
 */
import type { Node as PMNode, Mark } from '@tiptap/pm/model';

// ── 序列化状态 ────────────────────────────────────���─────────────

class MarkdownSerializerState {
  output = '';
  private closed: PMNode | null = null;
  private inTightList = false;

  /** 写入文本 */
  write(text: string) {
    this.flushClose();
    this.output += text;
  }

  /** 写入一行（末尾加换行） */
  writeLine(text: string) {
    this.write(text + '\n');
  }

  /** 确保输出以换行结尾 */
  ensureNewline() {
    if (this.output.length && !this.output.endsWith('\n')) {
      this.output += '\n';
    }
  }

  /** 关闭段落（延迟写入换行，用于列表紧凑模式判断） */
  closeBlock(node: PMNode) {
    this.closed = node;
  }

  flushClose(extra = 0) {
    if (!this.closed) return;
    this.closed = null;
    this.ensureNewline();
    for (let i = 0; i < extra; i++) this.output += '\n';
  }

  /** 增加空行分隔 */
  blankLine() {
    this.flushClose();
    this.ensureNewline();
    if (!this.output.endsWith('\n\n')) {
      this.output += '\n';
    }
  }

  /** 序列化 inline 内容 */
  renderInline(parent: PMNode) {
    parent.forEach((child, _offset, index) => {
      if (child.isText) {
        this.renderMarks(child, parent, index, true);
        this.write(this.escapeInline(child.text ?? ''));
        this.renderMarks(child, parent, index, false);
      } else {
        this.renderMarks(child, parent, index, true);
        this.renderNode(child);
        this.renderMarks(child, parent, index, false);
      }
    });
  }

  private activeMarks: readonly Mark[] = [];

  /** 开启/关闭 marks */
  private renderMarks(node: PMNode, parent: PMNode, index: number, opening: boolean) {
    const marks = node.marks;
    if (opening) {
      // 开启新 marks
      for (const mark of marks) {
        if (!mark.isInSet(this.activeMarks)) {
          this.activeMarks = mark.addToSet(this.activeMarks);
          this.write(this.markDelimiter(mark, true));
        }
      }
    } else {
      // 检查下一个节点是否继续拥有这些 marks
      const next = index + 1 < parent.childCount ? parent.child(index + 1) : null;
      for (let i = marks.length - 1; i >= 0; i--) {
        const mark = marks[i];
        if (!next || !mark.isInSet(next.marks)) {
          this.activeMarks = mark.removeFromSet(this.activeMarks);
          this.write(this.markDelimiter(mark, false));
        }
      }
    }
  }

  private markDelimiter(mark: Mark, _opening: boolean): string {
    switch (mark.type.name) {
      case 'bold': return '**';
      case 'italic': return '*';
      case 'strike': return '~~';
      case 'code': return '`';
      case 'highlight': return '==';
      case 'link':
        if (_opening) return '[';
        return `](${mark.attrs.href}${mark.attrs.title ? ` "${mark.attrs.title}"` : ''})`;
      default: return '';
    }
  }

  private escapeInline(text: string): string {
    // 对行内 markdown 特殊字符进行最小化转义
    // 不转义 # < > 等因为它们只在行首有意义
    return text;
  }

  /** 序列化节点 */
  renderNode(node: PMNode) {
    const handler = nodeSerializers[node.type.name];
    if (handler) {
      handler(this, node);
    } else {
      // 未知节点 → 按文本序列化
      if (node.isTextblock) {
        this.renderInline(node);
        this.closeBlock(node);
      } else {
        this.renderContent(node);
      }
    }
  }

  /** 递归序列化子节点 */
  renderContent(parent: PMNode) {
    parent.forEach((child, _offset, index) => {
      if (index > 0) {
        // 块级节点之间插入空行
        if (child.isBlock) {
          this.blankLine();
        }
      }
      this.renderNode(child);
    });
  }

  /** 序列化列表 */
  renderList(node: PMNode, getDelim: (index: number, node: PMNode) => string) {
    const prevTight = this.inTightList;
    this.inTightList = true;
    node.forEach((child, _offset, index) => {
      if (index > 0) this.ensureNewline();
      const delim = getDelim(index, child);
      this.write(delim);
      this.renderContent(child);
    });
    this.inTightList = prevTight;
  }
}

// ── 节点序列化器 ──────────────────���─────────────────────────────

type NodeSerializer = (state: MarkdownSerializerState, node: PMNode) => void;

const nodeSerializers: Record<string, NodeSerializer> = {
  doc(state, node) {
    state.renderContent(node);
  },

  paragraph(state, node) {
    state.renderInline(node);
    state.closeBlock(node);
  },

  heading(state, node) {
    state.write('#'.repeat(node.attrs.level) + ' ');
    state.renderInline(node);
    state.closeBlock(node);
  },

  blockquote(state, node) {
    // 序列化引用块：逐行添加 > 前缀
    const inner = new MarkdownSerializerState();
    inner.renderContent(node);
    const text = inner.output.replace(/\n$/, '');
    const lines = text.split('\n');
    for (const line of lines) {
      state.writeLine(`> ${line}`);
    }
    state.closeBlock(node);
  },

  bulletList(state, node) {
    state.renderList(node, () => '- ');
  },

  orderedList(state, node) {
    const start = node.attrs.start ?? 1;
    state.renderList(node, (index) => `${start + index}. `);
  },

  listItem(state, node) {
    state.renderContent(node);
  },

  taskList(state, node) {
    state.renderList(node, (_index, child) => {
      const checked = child.attrs.checked;
      return checked ? '- [x] ' : '- [ ] ';
    });
  },

  taskItem(state, node) {
    state.renderContent(node);
  },

  codeBlock(state, node) {
    const lang = node.attrs.language || '';
    state.writeLine('```' + lang);
    state.writeLine(node.textContent);
    state.writeLine('```');
    state.closeBlock(node);
  },

  horizontalRule(state, node) {
    state.writeLine('---');
    state.closeBlock(node);
  },

  hardBreak(state) {
    state.write('  \n');
  },

  image(state, node) {
    const alt = node.attrs.alt || '';
    const src = node.attrs.src || '';
    const title = node.attrs.title;
    if (title) {
      state.write(`![${alt}](${src} "${title}")`);
    } else {
      state.write(`![${alt}](${src})`);
    }
  },

  // ── 表格 ──

  table(state, node) {
    const rows: PMNode[] = [];
    node.forEach((row) => rows.push(row));
    if (rows.length === 0) return;

    // 收集列数
    const colCount = rows[0].childCount;

    // 计算每列最大宽度
    const colWidths: number[] = Array(colCount).fill(3); // 最小3（分隔行 ---）
    for (const row of rows) {
      row.forEach((cell, _offset, colIndex) => {
        const text = cellToText(cell);
        colWidths[colIndex] = Math.max(colWidths[colIndex], text.length);
      });
    }

    // 序列化每行
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const cells: string[] = [];
      row.forEach((cell, _offset, colIndex) => {
        const text = cellToText(cell);
        cells.push(text.padEnd(colWidths[colIndex]));
      });
      state.writeLine('| ' + cells.join(' | ') + ' |');

      // 在第一行（表头）后插入分隔行
      if (r === 0) {
        const sep = colWidths.map(w => '-'.repeat(w));
        state.writeLine('| ' + sep.join(' | ') + ' |');
      }
    }
    state.closeBlock(node);
  },

  tableRow() { /* handled by table */ },
  tableHeader() { /* handled by table */ },
  tableCell() { /* handled by table */ },

  // ── 数学公式 ──

  mathBlock(state, node) {
    state.writeLine('$$');
    state.writeLine(node.textContent);
    state.writeLine('$$');
    state.closeBlock(node);
  },

  // ── Mermaid ──

  mermaidBlock(state, node) {
    state.writeLine('```mermaid');
    state.writeLine(node.textContent);
    state.writeLine('```');
    state.closeBlock(node);
  },

  // ── Callout ──

  callout(state, node) {
    const type = node.attrs.type || 'note';
    const title = node.attrs.title || '';
    state.writeLine(`> [!${type}] ${title}`.trimEnd());
    // 序列化子内容，每行加 > 前缀
    const inner = new MarkdownSerializerState();
    inner.renderContent(node);
    const text = inner.output.replace(/\n$/, '');
    for (const line of text.split('\n')) {
      state.writeLine(`> ${line}`);
    }
    state.closeBlock(node);
  },

  // ── Frontmatter ──

  frontmatter(state, node) {
    state.writeLine('---');
    state.writeLine(node.textContent);
    state.writeLine('---');
    state.closeBlock(node);
  },
};

/** 将表格单元格节点序列化为纯文本（含 inline 标记） */
function cellToText(cell: PMNode): string {
  const s = new MarkdownSerializerState();
  cell.forEach((child) => {
    if (child.type.name === 'paragraph') {
      s.renderInline(child);
    } else {
      s.renderNode(child);
    }
  });
  return s.output.trim();
}

// ── 导出 ─────────────────��────────────��───────────────────────

export function serializeMarkdown(doc: PMNode): string {
  const state = new MarkdownSerializerState();
  state.renderNode(doc);
  let output = state.output;
  // 确保文件以单个换行结尾
  output = output.replace(/\n*$/, '\n');
  return output;
}
