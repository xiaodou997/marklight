import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { openUrl } from '@tauri-apps/plugin-opener';

export const linkTooltipKey = new PluginKey('link-tooltip');

// 全局 tooltip 元素
let tooltipEl: HTMLDivElement | null = null;

function createTooltip(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;
  
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'link-tooltip';
  tooltipEl.style.cssText = `
    position: fixed;
    z-index: 1000;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 12px;
    max-width: 300px;
    display: none;
  `;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function showTooltip(view: EditorView, href: string, from: number, to: number) {
  const tooltip = createTooltip();
  
  // 截断过长的 URL
  const displayUrl = href.length > 40 ? href.substring(0, 40) + '...' : href;
  
  tooltip.innerHTML = `
    <div class="flex flex-col gap-2">
      <div class="text-gray-600 break-all">${displayUrl}</div>
      <div class="flex gap-2">
        <button class="copy-btn px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">复制链接</button>
        <button class="open-btn px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">打开链接</button>
      </div>
    </div>
  `;
  
  // 计算位置
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  const left = (start.left + end.left) / 2;
  const top = start.top;
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top + 20}px`;
  tooltip.style.transform = 'translateX(-50%)';
  tooltip.style.display = 'block';
  
  // 绑定事件
  const copyBtn = tooltip.querySelector('.copy-btn');
  const openBtn = tooltip.querySelector('.open-btn');
  
  copyBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(href);
      copyBtn.textContent = '已复制!';
      setTimeout(() => {
        copyBtn.textContent = '复制链接';
      }, 1500);
    } catch (err) {
      console.error('复制失败:', err);
    }
  });
  
  openBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await openUrl(href);
    } catch (err) {
      console.error('打开链接失败:', err);
    }
  });
  
  // 存储当前链接信息
  (tooltip as any)._currentLink = { href, from, to };
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.style.display = 'none';
    (tooltipEl as any)._currentLink = null;
  }
}

export const createLinkTooltipPlugin = () => {
  return new Plugin({
    key: linkTooltipKey,
    props: {
      handleClick(view, _pos, event) {
        const target = event.target as HTMLElement;
        
        // 检查点击的是否是链接
        const linkEl = target.closest('a');
        if (!linkEl) {
          hideTooltip();
          return false;
        }
        
        // 获取链接的 href
        const href = linkEl.getAttribute('href');
        if (!href) {
          hideTooltip();
          return false;
        }
        
        // 获取链接在文档中的位置
        try {
          // 找到链接文本节点
          const textNode = linkEl.textContent ? linkEl : linkEl.querySelector('span, text');
          if (!textNode) {
            hideTooltip();
            return false;
          }
          
          // 遍历文档找到包含此链接的位置
          const { state } = view;
          let linkFrom = -1;
          let linkTo = -1;
          
          state.doc.descendants((node, nodePos) => {
            if (node.isText && linkFrom === -1) {
              node.marks.forEach(mark => {
                if (mark.type.name === 'link' && mark.attrs.href === href) {
                  linkFrom = nodePos;
                  linkTo = nodePos + node.nodeSize;
                }
              });
            }
          });
          
          if (linkFrom === -1) {
            hideTooltip();
            return false;
          }
          
          // 如果 tooltip 已经显示且是同一个链接，则隐藏
          if (tooltipEl && (tooltipEl as any)._currentLink?.href === href) {
            hideTooltip();
            return true;
          }
          
          showTooltip(view, href, linkFrom, linkTo);
          event.preventDefault();
          return true;
        } catch (e) {
          console.error('Link tooltip error:', e);
          hideTooltip();
          return false;
        }
      },
      handleKeyDown(_view, event) {
        // 按 Escape 隐藏 tooltip
        if (event.key === 'Escape') {
          hideTooltip();
          return false;
        }
        return false;
      }
    }
  });
};

// 在点击编辑器其他区域时隐藏 tooltip
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (tooltipEl && !tooltipEl.contains(target) && !target.closest('a')) {
      hideTooltip();
    }
  });
}
