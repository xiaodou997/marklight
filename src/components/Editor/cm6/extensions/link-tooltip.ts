import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openUrl } from '@tauri-apps/plugin-opener';
import { EditorView } from '@codemirror/view';

type LinkInfo = {
  href: string;
  from: number;
  to: number;
};

let tooltipEl: HTMLDivElement | null = null;
let currentLink: LinkInfo | null = null;

function createTooltip(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;
  const el = document.createElement('div');
  el.className = 'cm6-link-tooltip';
  el.style.cssText = [
    'position: fixed',
    'z-index: 1000',
    'display: none',
    'background: white',
    'border: 1px solid #e5e7eb',
    'border-radius: 8px',
    'padding: 8px 12px',
    'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
    'font-size: 12px',
    'max-width: 320px',
  ].join(';');
  document.body.appendChild(el);
  tooltipEl = el;
  return el;
}

function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.style.display = 'none';
  currentLink = null;
}

function findLinkAtPos(view: EditorView, pos: number): LinkInfo | null {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const re = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const label = match[1] ?? '';
    const href = match[2] ?? '';
    const fullFrom = line.from + match.index;
    const labelFrom = fullFrom + 1;
    const labelTo = labelFrom + label.length;
    if (pos >= labelFrom && pos <= labelTo) {
      return {
        href,
        from: fullFrom,
        to: fullFrom + match[0].length,
      };
    }
  }
  return null;
}

function showTooltip(view: EditorView, link: LinkInfo) {
  const tooltip = createTooltip();
  const displayUrl = link.href.length > 48 ? `${link.href.slice(0, 48)}...` : link.href;
  tooltip.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div style="color:#4b5563;word-break:break-all;">${displayUrl}</div>
      <div style="display:flex;gap:8px;">
        <button data-action="copy" style="padding:2px 8px;font-size:12px;border-radius:4px;background:#3b82f6;color:#fff;">复制链接</button>
        <button data-action="open" style="padding:2px 8px;font-size:12px;border-radius:4px;background:#f3f4f6;color:#374151;">打开链接</button>
      </div>
    </div>
  `;

  const start = view.coordsAtPos(link.from);
  const end = view.coordsAtPos(link.to);
  if (!start || !end) return;
  const left = (start.left + end.left) / 2;
  const top = start.top + 24;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.transform = 'translateX(-50%)';
  tooltip.style.display = 'block';

  const copyBtn = tooltip.querySelector('[data-action="copy"]');
  const openBtn = tooltip.querySelector('[data-action="open"]');

  copyBtn?.addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      await writeText(link.href);
      (copyBtn as HTMLButtonElement).textContent = '已复制';
      setTimeout(() => {
        if (copyBtn instanceof HTMLButtonElement) {
          copyBtn.textContent = '复制链接';
        }
      }, 1200);
    } catch (error) {
      console.error('[CM6] copy link failed:', error);
    }
  });

  openBtn?.addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      await openUrl(link.href);
    } catch (error) {
      console.error('[CM6] open link failed:', error);
    }
  });

  currentLink = link;
}

function isInsideTooltip(target: EventTarget | null): boolean {
  return Boolean(target instanceof HTMLElement && tooltipEl?.contains(target));
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (isInsideTooltip(target)) return;
    if (target?.closest('.cm-link')) return;
    hideTooltip();
  });
}

export const linkTooltipExtension = EditorView.domEventHandlers({
  click(event, view) {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('cm6-link')) {
      return false;
    }

    const pos = view.posAtDOM(target, 0);
    const link = findLinkAtPos(view, pos);
    if (!link) return false;

    event.preventDefault();
    if (currentLink && currentLink.from === link.from && currentLink.to === link.to) {
      hideTooltip();
      return true;
    }
    showTooltip(view, link);
    return true;
  },
  keydown(event) {
    if (event.key === 'Escape') {
      hideTooltip();
    }
    return false;
  },
});
