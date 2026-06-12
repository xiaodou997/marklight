import { Extension } from '@tiptap/vue-3';
import { inputRegex as highlightInputRegex } from '@tiptap/extension-highlight';
import {
  starInputRegex as boldStarInputRegex,
  underscoreInputRegex as boldUnderscoreInputRegex,
} from '@tiptap/extension-bold';
import {
  starInputRegex as italicStarInputRegex,
  underscoreInputRegex as italicUnderscoreInputRegex,
} from '@tiptap/extension-italic';
import { inputRegex as strikeInputRegex } from '@tiptap/extension-strike';
import { inputRegexMatch as codeInputRegexMatch } from '@tiptap/extension-code';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { MarkType } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

const IME_SETTLE_DELAY_MS = 50;
const inlineMarksPluginKey = new PluginKey<InlineMarksState>('semanticInlineMarks');

type InlineMarksState = {
  composing: boolean;
  forceCheck: boolean;
  suppressUntil: number;
};

type Matcher = RegExp | ((text: string) => { index: number; text: string; replaceWith?: string } | null);

type InlineMarkCandidate = {
  name: string;
  finder: Matcher;
};

type InlineMatch = {
  markType: MarkType;
  fullStart: number;
  fullEnd: number;
  openingStart: number;
  innerStart: number;
  innerText: string;
};

const inlineMarkCandidates: InlineMarkCandidate[] = [
  { name: 'code', finder: codeInputRegexMatch },
  { name: 'bold', finder: boldStarInputRegex },
  { name: 'bold', finder: boldUnderscoreInputRegex },
  { name: 'strike', finder: strikeInputRegex },
  { name: 'highlight', finder: highlightInputRegex },
  { name: 'italic', finder: italicStarInputRegex },
  { name: 'italic', finder: italicUnderscoreInputRegex },
  { name: 'superscript', finder: /\^([^^]+)\^$/ },
  { name: 'subscript', finder: /~([^~]+)~$/ },
];

export const SemanticInlineMarks = Extension.create({
  name: 'semanticInlineMarks',

  addProseMirrorPlugins() {
    return [semanticInlineMarksPlugin()];
  },
});

function semanticInlineMarksPlugin(): Plugin<InlineMarksState> {
  return new Plugin<InlineMarksState>({
    key: inlineMarksPluginKey,

    state: {
      init() {
        return {
          composing: false,
          forceCheck: false,
          suppressUntil: 0,
        };
      },
      apply(tr, value) {
        const meta = tr.getMeta(inlineMarksPluginKey) as Partial<InlineMarksState> | undefined;
        if (!meta) {
          return {
            ...value,
            forceCheck: false,
          };
        }

        return {
          composing: meta.composing ?? value.composing,
          forceCheck: meta.forceCheck ?? false,
          suppressUntil: meta.suppressUntil ?? value.suppressUntil,
        };
      },
    },

    props: {
      handleDOMEvents: {
        compositionstart(view) {
          setInlineMarksState(view, {
            composing: true,
            forceCheck: false,
            suppressUntil: Number.POSITIVE_INFINITY,
          });
          return false;
        },
        compositionend(view) {
          const suppressUntil = Date.now() + IME_SETTLE_DELAY_MS;
          setInlineMarksState(view, {
            composing: false,
            forceCheck: false,
            suppressUntil,
          });
          window.setTimeout(() => {
            setInlineMarksState(view, {
              composing: false,
              forceCheck: true,
              suppressUntil: 0,
            });
          }, IME_SETTLE_DELAY_MS);
          return false;
        },
      },
    },

    appendTransaction(transactions, _oldState, newState) {
      const pluginState = inlineMarksPluginKey.getState(newState);
      if (pluginState?.composing) return null;
      if (pluginState && pluginState.suppressUntil > Date.now()) return null;

      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged && !pluginState?.forceCheck) return null;

      return convertPendingInlineMarks(newState.tr, newState);
    },
  });
}

function setInlineMarksState(view: EditorView, state: Partial<InlineMarksState>) {
  view.dispatch(view.state.tr.setMeta(inlineMarksPluginKey, state));
}

function matchInlineSyntax(
  textBeforeCursor: string,
  markType: MarkType,
  finder: Matcher,
): InlineMatch | null {
  if (typeof finder === 'function') {
    const result = finder(textBeforeCursor);
    if (!result) return null;

    const innerText = result.replaceWith ?? result.text;
    if (!innerText) return null;

    return {
      markType,
      fullStart: result.index,
      fullEnd: result.index + result.text.length,
      openingStart: result.index,
      innerStart: result.index + result.text.indexOf(innerText),
      innerText,
    };
  }

  const result = finder.exec(textBeforeCursor);
  if (!result) return null;

  const innerText = result[result.length - 1];
  if (!innerText) return null;

  const fullStart = result.index ?? textBeforeCursor.length - result[0].length;
  const fullMatch = result[0];
  const leadingOffset = fullMatch.search(/\S/);

  return {
    markType,
    fullStart,
    fullEnd: fullStart + fullMatch.length,
    openingStart: fullStart + Math.max(0, leadingOffset),
    innerStart: fullStart + fullMatch.lastIndexOf(innerText),
    innerText,
  };
}

function findPendingInlineMark(state: EditorState): InlineMatch | null {
  const { selection, schema } = state;
  const { $cursor } = selection as TextSelection;
  if (!$cursor) return null;

  const parent = $cursor.parent;
  if (!parent.isTextblock || parent.type.spec.code) return null;

  const textBeforeCursor = parent.textBetween(0, $cursor.parentOffset, undefined, '\ufffc');
  if (!textBeforeCursor) return null;

  for (const candidate of inlineMarkCandidates) {
    const markType = schema.marks[candidate.name];
    if (!markType) continue;

    const match = matchInlineSyntax(textBeforeCursor, markType, candidate.finder);
    if (match) return match;
  }

  return null;
}

export function convertPendingInlineMarks(
  tr: Transaction,
  state: EditorState,
): Transaction | null {
  const { selection } = state;
  const { $cursor } = selection as TextSelection;
  if (!$cursor) return null;

  const match = findPendingInlineMark(state);
  if (!match) return null;

  const parentStart = $cursor.start();
  const openingStart = parentStart + match.openingStart;
  const innerStart = parentStart + match.innerStart;
  const innerEnd = innerStart + match.innerText.length;
  const closingEnd = parentStart + match.fullEnd;

  if (match.innerText.length === 0) return null;
  if (openingStart > innerStart || innerEnd > closingEnd) return null;

  tr.delete(innerEnd, closingEnd);
  tr.delete(openingStart, innerStart);
  tr.addMark(openingStart, openingStart + match.innerText.length, match.markType.create());
  tr.removeStoredMark(match.markType);

  return tr.steps.length ? tr : null;
}
