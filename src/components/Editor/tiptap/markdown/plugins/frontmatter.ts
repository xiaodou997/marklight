import type { Schema } from '@tiptap/pm/model';
import type { MarkdownSerializerState, NodeSerializer } from '../serializer';
import type { MarkdownSyntaxPlugin, Preprocessor } from './index';

export interface FrontmatterData {
  frontmatter: string | null;
}

export function frontmatterPreprocessor(schema: Schema): Preprocessor<FrontmatterData> {
  return {
    name: 'frontmatter',
    preprocess({ content }) {
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
      if (!match) {
        return { content, data: { frontmatter: null } };
      }

      return {
        content: content.slice(match[0].length),
        data: { frontmatter: match[1] },
      };
    },
    beforeParse(state, data) {
      if (data.frontmatter && schema.nodes.frontmatter) {
        state.addNode(schema.nodes.frontmatter, {}, [schema.text(data.frontmatter)]);
      }
    },
  };
}

export const frontmatterNodeSerializers: Record<string, NodeSerializer> = {
  frontmatter(state: MarkdownSerializerState, node) {
    state.writeLine('---');
    state.writeLine(node.textContent);
    state.writeLine('---');
    state.closeBlock(node);
  },
};

export const frontmatterMarkdownPlugin: MarkdownSyntaxPlugin = {
  name: 'frontmatter',
  preprocessor: frontmatterPreprocessor,
  nodeSerializers: frontmatterNodeSerializers,
};
