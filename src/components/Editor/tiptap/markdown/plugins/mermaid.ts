import type { Schema } from '@tiptap/pm/model';
import type { MarkdownSerializerState, NodeSerializer } from '../serializer';
import type { FenceHandler, MarkdownSyntaxPlugin } from './index';

export function mermaidFenceHandler(schema: Schema): FenceHandler | null {
  if (!schema.nodes.mermaidBlock) {
    return null;
  }

  return (state, _token, language, content) => {
    if (language !== 'mermaid') {
      return false;
    }

    state.addNode(schema.nodes.mermaidBlock, {}, content ? [schema.text(content)] : undefined);
    return true;
  };
}

export const mermaidNodeSerializers: Record<string, NodeSerializer> = {
  mermaidBlock(state: MarkdownSerializerState, node) {
    state.writeLine('```mermaid');
    state.writeLine(node.textContent);
    state.writeLine('```');
    state.closeBlock(node);
  },
};

export const mermaidMarkdownPlugin: MarkdownSyntaxPlugin = {
  name: 'mermaid',
  fenceHandler: mermaidFenceHandler,
  nodeSerializers: mermaidNodeSerializers,
};
