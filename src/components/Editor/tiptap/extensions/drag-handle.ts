import { Extension } from '@tiptap/vue-3';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

const dragHandleKey = new PluginKey('dragHandle');

function getTopLevelBlockAt(view: EditorView, pos: number): { node: PMNode; pos: number; dom: HTMLElement } | null {
  const $pos = view.state.doc.resolve(pos);
  const depth = $pos.depth;
  if (depth === 0) return null;

  let blockPos = $pos.before(1);
  const node = view.state.doc.nodeAt(blockPos);
  if (!node) return null;

  const dom = view.nodeDOM(blockPos);
  if (!dom || !(dom instanceof HTMLElement)) return null;

  return { node, pos: blockPos, dom };
}

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let handle: HTMLElement | null = null;
    let currentBlockPos = -1;
    let draggedBlockPos = -1;
    function createHandle() {
      const el = document.createElement('div');
      el.className = 'mk-drag-handle';
      el.setAttribute('draggable', 'true');
      el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg>';
      el.style.display = 'none';
      return el;
    }

    function positionHandle(view: EditorView, blockDom: HTMLElement) {
      if (!handle) return;
      const editorRect = view.dom.getBoundingClientRect();
      const blockRect = blockDom.getBoundingClientRect();

      handle.style.display = 'flex';
      handle.style.top = `${blockRect.top - editorRect.top + view.dom.scrollTop}px`;
      handle.style.left = '-28px';
    }

    function hideHandle() {
      if (handle) handle.style.display = 'none';
      currentBlockPos = -1;
    }

    return [
      new Plugin({
        key: dragHandleKey,
        view(editorView) {
          handle = createHandle();
          editorView.dom.parentElement?.style.setProperty('position', 'relative');
          editorView.dom.parentElement?.appendChild(handle);

          handle.addEventListener('dragstart', (e) => {
            if (currentBlockPos < 0) return;
            draggedBlockPos = currentBlockPos;
            e.dataTransfer?.setData('text/plain', '');
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            handle!.classList.add('mk-drag-handle--dragging');
          });

          handle.addEventListener('dragend', () => {
            handle!.classList.remove('mk-drag-handle--dragging');
            draggedBlockPos = -1;
            editorView.dom.querySelectorAll('.mk-drop-indicator').forEach((el) => el.remove());
          });

          return {
            destroy() {
              handle?.remove();
              handle = null;
            },
          };
        },
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (!pos) {
                hideHandle();
                return false;
              }

              const block = getTopLevelBlockAt(view, pos.pos);
              if (!block) {
                hideHandle();
                return false;
              }

              if (block.pos !== currentBlockPos) {
                currentBlockPos = block.pos;
                positionHandle(view, block.dom);
              }
              return false;
            },
            mouseleave() {
              setTimeout(hideHandle, 200);
              return false;
            },
            drop(view, event) {
              if (draggedBlockPos < 0) return false;

              const coords = { left: event.clientX, top: event.clientY };
              const dropPos = view.posAtCoords(coords);
              if (!dropPos) return false;

              const dropBlock = getTopLevelBlockAt(view, dropPos.pos);
              if (!dropBlock || dropBlock.pos === draggedBlockPos) return false;

              event.preventDefault();

              const { state } = view;
              const draggedNode = state.doc.nodeAt(draggedBlockPos);
              if (!draggedNode) return false;

              const draggedSize = draggedNode.nodeSize;
              let tr = state.tr;

              const insertPos = dropBlock.pos > draggedBlockPos
                ? dropBlock.pos + dropBlock.node.nodeSize
                : dropBlock.pos;

              const adjustedInsertPos = draggedBlockPos < insertPos
                ? insertPos - draggedSize
                : insertPos;

              tr = tr.delete(draggedBlockPos, draggedBlockPos + draggedSize);
              tr = tr.insert(adjustedInsertPos, draggedNode);

              view.dispatch(tr);
              draggedBlockPos = -1;
              return true;
            },
            dragover(_view, event) {
              if (draggedBlockPos < 0) return false;
              event.preventDefault();
              if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
              return false;
            },
          },
        },
      }),
    ];
  },
});
