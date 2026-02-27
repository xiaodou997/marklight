import { createApp, h, Component, App, reactive } from 'vue';
import { Node as ProsemirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';

/**
 * Vue NodeView 桥接器
 * 将 Vue 组件作为 ProseMirror 的 NodeView 渲染
 */
export class VueNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  private vm: App;
  private currentNode: ProsemirrorNode;

  constructor(
    node: ProsemirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
    component: Component
  ) {
    this.dom = document.createElement('div');
    this.dom.style.display = node.isInline ? 'inline-block' : 'block';
    this.currentNode = node;

    const self = this;

    this.vm = createApp({
      setup() {
        const nodeState = reactive({ 
          node: node 
        });
        
        const updateAttributes = (attrs: Record<string, any>) => {
          const pos = getPos();
          if (pos !== undefined) {
            const tr = view.state.tr.setNodeMarkup(pos, undefined, {
              ...nodeState.node.attrs,
              ...attrs
            });
            view.dispatch(tr);
          }
        };

        // 替换节点文本内容（用于 code_block 等含文本内容的节点）
        const updateContent = (text: string) => {
          const pos = getPos();
          if (pos === undefined) return;
          const n = nodeState.node;
          const tr = view.state.tr;
          // 替换节点内部所有内容为新文本
          const from = pos + 1;
          const to = pos + n.nodeSize - 1;
          const textNode = text ? view.state.schema.text(text) : null;
          if (textNode) {
            tr.replaceWith(from, to, textNode);
          } else {
            tr.delete(from, to);
          }
          view.dispatch(tr);
        };

        // 暴露更新节点的方法
        (self as any).updateNode = (newNode: ProsemirrorNode) => {
          nodeState.node = newNode;
        };

        return () => h(component, {
          node: nodeState.node,
          updateAttributes,
          updateContent
        });
      }
    });

    this.vm.mount(this.dom);

    // 通过 data-content-dom 属性查找内容编辑区（避免 createApp 包装组件实例问题）
    const contentEl = this.dom.querySelector('[data-content-dom]');
    if (contentEl instanceof HTMLElement) {
      this.contentDOM = contentEl;
    }
  }

  update(node: ProsemirrorNode): boolean {
    // 只有相同类型的节点才能更新
    if (node.type.name !== this.currentNode.type.name) {
      return false;
    }
    this.currentNode = node;
    if ((this as any).updateNode) {
      (this as any).updateNode(node);
    }
    return true;
  }

  destroy() {
    this.vm.unmount();
  }
}

/**
 * 创建 NodeView 工厂函数
 */
export const createVueNodeView = (component: Component) => {
  return (node: ProsemirrorNode, view: EditorView, getPos: () => number | undefined) => {
    return new VueNodeView(node, view, getPos, component);
  };
};
