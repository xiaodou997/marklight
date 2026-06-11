import type { Schema } from '@tiptap/pm/model';
import type { MarkdownParseState } from '../parser';
import type { MarkdownSerializerState, NodeSerializer } from '../serializer';
import type { MarkdownSyntaxPlugin, Preprocessor, TokenInterceptor } from './index';

interface CalloutData {
  callouts: Array<{ type: string; title: string; body: string }>;
}

function getCalloutData(state: MarkdownParseState): CalloutData {
  return (state.pluginData.callout as CalloutData | undefined) ?? { callouts: [] };
}

function getCalloutPlaceholderIndex(content: string): number | null {
  const calloutMatch = content.match(/<!--CALLOUT_BLOCK_(\d+)-->/);
  return calloutMatch ? parseInt(calloutMatch[1]) : null;
}

function addCalloutNode(
  schema: Schema,
  state: MarkdownParseState,
  callout: { type: string; title: string; body: string },
) {
  state.openNode(schema.nodes.callout, {
    type: callout.type,
    title: callout.title || callout.type,
  });

  if (callout.body) {
    state.openNode(schema.nodes.paragraph);
    state.addText(callout.body);
    state.closeNode();
  } else {
    state.addNode(schema.nodes.paragraph);
  }

  state.closeNode();
}

export function calloutPreprocessor(schema: Schema): Preprocessor<CalloutData> | null {
  if (!schema.nodes.callout) {
    return null;
  }

  return {
    name: 'callout',
    preprocess({ content }) {
      const callouts: CalloutData['callouts'] = [];
      const processed = content.replace(
        /^> \[!(\w+)\]\s*(.*)\n((?:>.*\n?)*)/gm,
        (_match, type, title, bodyRaw) => {
          const body = bodyRaw.replace(/^> ?/gm, '').trim();
          const index = callouts.length;
          callouts.push({ type: type.toLowerCase(), title: title.trim(), body });
          return `\n<!--CALLOUT_BLOCK_${index}-->\n`;
        },
      );

      return { content: processed, data: { callouts } };
    },
  };
}

export function calloutTokenInterceptor(schema: Schema): TokenInterceptor | null {
  if (!schema.nodes.callout) {
    return null;
  }

  return (state, token, tokens, index) => {
    if (
      token.type === 'paragraph_open' &&
      tokens[index + 1]?.type === 'inline' &&
      getCalloutPlaceholderIndex(tokens[index + 1].content) !== null
    ) {
      return true;
    }

    if (
      token.type === 'paragraph_close' &&
      tokens[index - 1]?.type === 'inline' &&
      getCalloutPlaceholderIndex(tokens[index - 1].content) !== null
    ) {
      return true;
    }

    if (token.type !== 'html_block' && token.type !== 'inline') {
      return false;
    }

    const calloutIndex = getCalloutPlaceholderIndex(token.content);
    if (calloutIndex === null) {
      return false;
    }

    const callout = getCalloutData(state).callouts[calloutIndex];
    if (callout) {
      addCalloutNode(schema, state, callout);
      return true;
    }

    return false;
  };
}

export const calloutNodeSerializers: Record<string, NodeSerializer> = {
  callout(state: MarkdownSerializerState, node) {
    const type = node.attrs.type || 'note';
    const title = node.attrs.title || '';
    state.writeLine(`> [!${type}] ${title}`.trimEnd());

    const InnerState = state.constructor as new () => MarkdownSerializerState;
    const inner = new InnerState();
    inner.renderContent(node);
    const text = inner.output.replace(/\n$/, '');
    for (const line of text.split('\n')) {
      state.writeLine(`> ${line}`);
    }

    state.closeBlock(node);
  },
};

export const calloutMarkdownPlugin: MarkdownSyntaxPlugin = {
  name: 'callout',
  preprocessor: calloutPreprocessor,
  tokenInterceptor: calloutTokenInterceptor,
  nodeSerializers: calloutNodeSerializers,
};
