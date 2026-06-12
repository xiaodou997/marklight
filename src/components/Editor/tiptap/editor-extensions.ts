import type { Ref } from 'vue';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { CustomCodeBlock } from './extensions/code-block';
import { SemanticHeading } from './extensions/semantic-heading';
import {
  CustomTable,
  CustomTableRow,
  CustomTableHeader,
  CustomTableCell,
} from './extensions/table';
import { CustomImage } from './extensions/image';
import { MathBlock } from './extensions/math-block';
import { MathInline } from './extensions/math-inline';
import { MermaidBlock } from './extensions/mermaid-block';
import { Callout } from './extensions/callout';
import { Frontmatter } from './extensions/frontmatter';
import { SemanticInlineMarks } from './extensions/semantic-inline-marks';
import { MarkdownInputRules } from './extensions/input-rules';
import { Superscript, Subscript } from './extensions/sub-sup';
import { Wikilink } from './extensions/wikilink';
import {
  SlashCommands,
  slashCommandItems,
  type SlashCommandItem,
} from './extensions/slash-commands';
import { DragHandle } from './extensions/drag-handle';

type SlashCommandSuggestionProps = SuggestionProps<SlashCommandItem, SlashCommandItem>;

export interface SlashMenuController {
  show: (position: { top: number; left: number }) => void;
  hide: () => void;
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface EditorExtensionOptions {
  slashMenuRef: Ref<SlashMenuController | null>;
  slashMenuItems: Ref<SlashCommandItem[]>;
  slashMenuCommand: Ref<(item: SlashCommandItem) => void>;
}

export function createEditorExtensions(options: EditorExtensionOptions) {
  const { slashMenuRef, slashMenuItems, slashMenuCommand } = options;

  return [
    StarterKit.configure({
      // 禁用 StarterKit 内置节点，使用自定义扩展处理 Markdown fidelity 和 IME 行为。
      codeBlock: false,
      link: false,
      heading: false,
    }),
    SemanticHeading,
    CustomCodeBlock,
    CustomTable,
    CustomTableRow,
    CustomTableHeader,
    CustomTableCell,
    CustomImage,
    Highlight.configure({ multicolor: false }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: '' },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: '开始写作...',
    }),
    MathBlock,
    MathInline,
    MermaidBlock,
    Callout,
    Frontmatter,
    SemanticInlineMarks,
    MarkdownInputRules,
    Superscript,
    Subscript,
    Wikilink,
    SlashCommands.configure({
      suggestion: {
        char: '/',
        startOfLine: false,
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          return slashCommandItems.filter(
            (item) =>
              item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
          );
        },
        render: () => ({
          onStart: (props: SlashCommandSuggestionProps) => {
            slashMenuItems.value = props.items;
            slashMenuCommand.value = props.command;
            const rect = props.clientRect?.();
            if (rect) slashMenuRef.value?.show({ top: rect.bottom + 4, left: rect.left });
          },
          onUpdate: (props: SlashCommandSuggestionProps) => {
            slashMenuItems.value = props.items;
            slashMenuCommand.value = props.command;
            const rect = props.clientRect?.();
            if (rect) slashMenuRef.value?.show({ top: rect.bottom + 4, left: rect.left });
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            const { event } = props;
            if (event.key === 'Escape') {
              slashMenuRef.value?.hide();
              return true;
            }
            return slashMenuRef.value?.onKeyDown(event) ?? false;
          },
          onExit: () => {
            slashMenuRef.value?.hide();
          },
        }),
      },
    }),
    DragHandle,
  ];
}
