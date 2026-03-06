import { Plugin, PluginKey, EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import katex from 'katex';

export const mathPreviewPluginKey = new PluginKey<{
  showPreview: boolean;
  latex: string;
  error?: string;
  position: { left: number; top: number } | null;
} | null>('math-preview');

// 全局 tooltip 元素
let tooltipEl: HTMLDivElement | null = null;

/**
 * 创建预览 tooltip
 */
function createTooltip(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'math-preview-tooltip';
  tooltipEl.style.cssText = `
    position: fixed;
    z-index: 1000;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 200px;
    max-width: 400px;
    display: none;
    pointer-events: none;
  `;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

/**
 * 显示预览
 */
function showPreview(view: EditorView, latex: string, from: number, to: number) {
  const tooltip = createTooltip();

  try {
    // 使用 KaTeX 渲染
    const html = katex.renderToString(latex, {
      displayMode: false,
      throwOnError: true,
    });
    tooltip.innerHTML = html;
    tooltip.style.borderColor = '#e5e7eb';
  } catch (err: any) {
    // 渲染错误时显示错误信息
    tooltip.innerHTML = `<div style="color: #dc2626; font-size: 12px; font-family: monospace;">${err.message || '公式语法错误'}</div>`;
    tooltip.style.borderColor = '#fca5a5';
  }

  // 计算位置：显示在公式上方
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  
  if (!start || !end) {
    tooltip.style.display = 'none';
    return;
  }

  const left = (start.left + end.left) / 2;
  const top = start.top - 10; // 显示在公式上方

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top - tooltip.offsetHeight - 5}px`;
  tooltip.style.transform = 'translateX(-50%)';
  tooltip.style.display = 'block';
}

/**
 * 隐藏预览
 */
function hidePreview() {
  if (tooltipEl) {
    tooltipEl.style.display = 'none';
  }
}

/**
 * 检查位置是否在数学公式节点内
 */
function findMathNode(state: EditorState, pos: number): { from: number; to: number; latex: string } | null {
  const { doc } = state;
  
  // 检查是否在 math_inline 节点内
  let found: { from: number; to: number; latex: string } | null = null;
  
  doc.nodesBetween(0, doc.content.size, (node, nodePos) => {
    if (found) return false; // 已找到，停止遍历
    
    if (node.type.name === 'math_inline') {
      const nodeFrom = nodePos;
      const nodeTo = nodePos + node.nodeSize;
      
      if (pos >= nodeFrom && pos <= nodeTo) {
        found = {
          from: nodeFrom,
          to: nodeTo,
          latex: node.attrs.latex || ''
        };
      }
    }
    
    // 不深入子节点，因为我们只关心直接的 math_inline 节点
    return !found;
  });
  
  return found;
}

/**
 * 创建数学公式预览插件
 */
export function createMathPreviewPlugin(): Plugin {
  let lastLatex: string | null = null;
  let lastPos: number | null = null;

  return new Plugin({
    key: mathPreviewPluginKey,

    state: {
      init: () => null,
      apply: (tr) => {
        const meta = tr.getMeta(mathPreviewPluginKey);
        if (meta) return meta;
        return null;
      }
    },

    view: function(_editorView: EditorView) {
      let currentSelection: { from: number; to: number } | null = null;

      return {
        update: (view: EditorView) => {
          const { state } = view;
          const { selection } = state;

          // 检查选择是否变化
          if (
            !currentSelection ||
            currentSelection.from !== selection.from ||
            currentSelection.to !== selection.to
          ) {
            currentSelection = { from: selection.from, to: selection.to };

            // 查找光标位置是否在数学公式内
            const mathNode = findMathNode(state, selection.from);

            if (mathNode && mathNode.latex) {
              // 如果 latex 或位置变化，更新预览
              if (mathNode.latex !== lastLatex || selection.from !== lastPos) {
                lastLatex = mathNode.latex;
                lastPos = selection.from;
                showPreview(view, mathNode.latex, mathNode.from, mathNode.to);
              }
            } else {
              // 不在数学公式内，隐藏预览
              hidePreview();
              lastLatex = null;
              lastPos = null;
            }
          }
        },

        destroy: () => {
          hidePreview();
          if (tooltipEl) {
            document.body.removeChild(tooltipEl);
            tooltipEl = null;
          }
        }
      };
    }
  });
}
