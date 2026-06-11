<template>
  <div
    class="editor-shell h-full w-full cursor-text transition-colors"
    style="background-color: var(--bg-color)"
    @click="handleContainerClick"
  >
    <div ref="editorWrapRef" class="mk-editor h-full px-6 py-8 overflow-y-auto outline-none">
      <EditorContent v-if="editor" :editor="editor" />
    </div>

    <BubbleMenuComponent ref="bubbleMenuRef" :on-action="onBubbleMenuAction" />
    <SlashMenu ref="slashMenuRef" :items="slashMenuItems" :command="slashMenuCommand" />
    <SearchBar
      ref="searchBarRef"
      :visible="isSearchVisible"
      :match-count="searchMatchCount"
      :current-index="searchCurrentIndex"
      @query="onSearchQuery"
      @case-sensitive="onSearchCaseSensitive"
      @next="onSearchNext"
      @prev="onSearchPrev"
      @replace="onSearchReplace"
      @replace-all="onSearchReplaceAll"
      @close="closeSearch"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef, onBeforeUnmount } from 'vue';
import { debounce } from 'lodash-es';
import { Editor as TiptapEditor, EditorContent } from '@tiptap/vue-3';

import { useFileStore } from '../../stores/file';
import { parseMarkdown } from './tiptap/markdown/parser';
import { serializeMarkdown } from './tiptap/markdown/serializer';
import type { SlashCommandItem } from './tiptap/extensions/slash-commands';
import {
  executeEditorCommand,
  runBubbleMenuAction,
  type BubbleMenuActionData,
} from './tiptap/editor-commands';
import { createEditorExtensions, type SlashMenuController } from './tiptap/editor-extensions';
import {
  extractEditorOutline,
  getEditorCursorInfo,
  getEditorWordCount,
  type EditorOutlineItem,
} from './tiptap/editor-metadata';
import { setupEditorImageDrop } from './tiptap/editor-image-drop';
import { useEditorAppearance } from './tiptap/useEditorAppearance';
import { useEditorSearch } from './tiptap/useEditorSearch';
import BubbleMenuComponent from './views/BubbleMenu.vue';
import SlashMenu from './views/SlashMenu.vue';
import SearchBar from './SearchBar.vue';
import './tiptap/editor.css';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

type EditorUpdatePayload = {
  wordCount?: number;
  cursor?: { line: number; col: number };
  selectionText?: string;
  outline?: EditorOutlineItem[];
};

const props = defineProps<{ initialContent?: string }>();
const emit = defineEmits<{ (e: 'update', data: EditorUpdatePayload): void }>();

const fileStore = useFileStore();
const editorWrapRef = ref<HTMLElement | null>(null);
const bubbleMenuRef = ref<InstanceType<typeof BubbleMenuComponent> | null>(null);
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null);
const slashMenuRef = ref<SlashMenuController | null>(null);
const slashMenuItems = ref<SlashCommandItem[]>([]);
const slashMenuCommand = ref<(item: SlashCommandItem) => void>(() => {});
useEditorAppearance();

// ── 创建 TipTap Editor ────────────────────────────────────────

const editor = shallowRef<TiptapEditor | null>(null);
const {
  isSearchVisible,
  searchMatchCount,
  searchCurrentIndex,
  onSearchQuery,
  onSearchCaseSensitive,
  onSearchNext,
  onSearchPrev,
  onSearchReplace,
  onSearchReplaceAll,
  openSearch,
  closeSearch,
} = useEditorSearch(editor);

function createEditor(content: string) {
  if (editor.value) {
    editor.value.destroy();
  }

  const e = new TiptapEditor({
    extensions: createEditorExtensions({
      slashMenuRef,
      slashMenuItems,
      slashMenuCommand,
    }),
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor: ed }) => {
      debouncedUpdate(ed as unknown as TiptapEditor);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      updateBubbleMenu(ed as unknown as TiptapEditor);
      emitCursorInfo(ed as unknown as TiptapEditor);
    },
  });

  // 解析 markdown 并设置文档
  if (content) {
    const doc = parseMarkdown(e.schema, content);
    e.commands.setContent(doc.toJSON());
  }

  editor.value = e;

  // 同步基线：setContent + appendTransaction 完成后，序列化结果作为 store 基准
  // 避免 parser/serializer round-trip 差异导致误判 dirty
  const baseline = serializeMarkdown(e.state.doc);
  fileStore.setContent(baseline);
}

// ── 更新回调 ──────────────────────────────────────────────────

const debouncedUpdate = debounce((ed: TiptapEditor) => {
  const markdown = serializeMarkdown(ed.state.doc);
  // 规范化比较：序列化器总是追加 \n，store 初始值可能是 ''
  const normalizedStored = fileStore.currentFile.content.replace(/\n+$/, '');
  const normalizedNew = markdown.replace(/\n+$/, '');
  if (normalizedNew !== normalizedStored) {
    fileStore.markUserEdit();
    fileStore.setContent(markdown);
  }

  const wordCount = getEditorWordCount(ed);
  const outline = extractEditorOutline(ed);

  emit('update', { wordCount, outline });
}, 300);

function emitCursorInfo(ed: TiptapEditor) {
  emit('update', getEditorCursorInfo(ed));
}

// ── BubbleMenu ────────────────────────────────────────────────

function updateBubbleMenu(ed: TiptapEditor) {
  const { from, to, empty } = ed.state.selection;
  if (empty) {
    bubbleMenuRef.value?.update(false, 0, 0, {});
    return;
  }

  // 获取选区坐标
  const coords = ed.view.coordsAtPos(from);
  const endCoords = ed.view.coordsAtPos(to);
  const left = (coords.left + endCoords.left) / 2;
  const top = coords.top;

  // 检测当前 marks
  const marks = {
    bold: ed.isActive('bold'),
    italic: ed.isActive('italic'),
    code: ed.isActive('code'),
    link: ed.isActive('link'),
  };

  const linkAttributes = ed.getAttributes('link') as { href?: unknown };
  const linkHref = typeof linkAttributes.href === 'string' ? linkAttributes.href : undefined;

  bubbleMenuRef.value?.update(true, left, top, marks, linkHref);
}

function onBubbleMenuAction(type: string, data?: BubbleMenuActionData) {
  runBubbleMenuAction(editor.value, type, data);
}

// ── 容器点击 ──────────────────────────────────────────────────

function handleContainerClick(event: MouseEvent) {
  // 点击编辑器空白区域时聚焦到编辑器末尾
  const target = event.target as HTMLElement;
  if (target === editorWrapRef.value) {
    editor.value?.commands.focus('end');
  }
}

// ── 图片拖拽上传 ──────────────────────────────────────────────

let unlistenDragDrop: (() => void) | null = null;

async function setupDragDrop() {
  unlistenDragDrop = await setupEditorImageDrop({
    editor,
    getDocumentPath: () => fileStore.currentFile.path,
  });
}

// ── 生命周期 ──────────────────────────────────────────────────

onMounted(() => {
  createEditor(props.initialContent || '');
  setupDragDrop();
});

onBeforeUnmount(() => {
  debouncedUpdate.cancel();
  editor.value?.destroy();
  editor.value = null;
  if (unlistenDragDrop) {
    unlistenDragDrop();
    unlistenDragDrop = null;
  }
});

// ── Expose ────────────────────────────────────────────────────

defineExpose({
  scrollToPos: (pos: number) => {
    if (!editor.value) return;
    const docSize = editor.value.state.doc.content.size;
    const target = Math.max(0, Math.min(pos, docSize));
    editor.value.commands.focus(target);
    // 滚动到视图
    const dom = editor.value.view.domAtPos(target);
    if (dom.node instanceof HTMLElement) {
      dom.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (dom.node.parentElement) {
      dom.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
  getContent: () => {
    if (!editor.value) return '';
    return serializeMarkdown(editor.value.state.doc);
  },
  getDoc: () => editor.value?.state.doc ?? null,
  getSelectionMarkdown: () => {
    if (!editor.value) return '';
    const { from, to, empty } = editor.value.state.selection;
    if (empty) return '';
    return editor.value.state.doc.textBetween(from, to, '\n');
  },
  getEditorView: () => editor.value?.view ?? null,
  hasFocus: () => editor.value?.isFocused ?? false,
  executeCommand: (commandId: string) => executeEditorCommand(editor.value, commandId),
  undo: () => editor.value?.commands.undo(),
  redo: () => editor.value?.commands.redo(),
  openSearch: (_showReplace = false) => {
    openSearch();
    searchBarRef.value?.setShowReplace(_showReplace);
  },
  closeSearch,
});
</script>
