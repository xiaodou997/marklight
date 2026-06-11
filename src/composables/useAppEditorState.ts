import { reactive, ref } from 'vue';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { OutlineItem } from '../components/Editor/Sidebar.vue';

export type AppEditorExpose = {
  scrollToPos: (pos: number) => void;
  openSearch: (showReplace?: boolean) => void;
  getContent?: () => string;
  getDoc?: () => PMNode | null;
  getSelectionMarkdown?: () => string;
  getEditorView: () => EditorView | null;
  hasFocus?: () => boolean;
  executeCommand?: (commandId: string) => boolean;
};

export type AppEditorUpdatePayload = {
  wordCount?: number;
  cursor?: { line: number; col: number };
  selectionText?: string;
  outline?: OutlineItem[];
};

export function useAppEditorState() {
  const editorRef = ref<AppEditorExpose | null>(null);
  const stats = reactive({
    wordCount: 0,
    cursor: { line: 1, col: 1 },
    selectionText: '',
  });
  const outlineItems = ref<OutlineItem[]>([]);

  function handleEditorUpdate(data: AppEditorUpdatePayload) {
    if (data.wordCount !== undefined) stats.wordCount = data.wordCount;
    if (data.cursor) stats.cursor = data.cursor;
    if (data.selectionText !== undefined) stats.selectionText = data.selectionText;
    if (data.outline) outlineItems.value = data.outline;
  }

  function scrollToHeading(pos: number) {
    editorRef.value?.scrollToPos(pos);
  }

  return {
    editorRef,
    stats,
    outlineItems,
    handleEditorUpdate,
    scrollToHeading,
  };
}
