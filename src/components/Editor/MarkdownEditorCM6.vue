<template>
  <div
    class="editor-shell h-full w-full cursor-text transition-colors"
    style="background-color: var(--bg-color);"
    @click="handleContainerClick"
  >
    <div ref="editorRef" class="cm6-editor h-full px-12 py-8 overflow-y-auto outline-none"></div>

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
import { onMounted, onUnmounted, ref } from 'vue';
import { debounce } from 'lodash-es';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

import { useFileStore } from '../../stores/file';
import { useSettingsStore } from '../../stores/settings';
import { parseMarkdown } from './core/markdown';
import { mySchema } from './core/schema';
import SearchBar from './SearchBar.vue';

const props = defineProps<{ initialContent?: string }>();
const emit = defineEmits<{ (e: 'update', data: any): void }>();

const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const editorRef = ref<HTMLElement | null>(null);
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null);

const isSearchVisible = ref(false);
const searchMatchCount = ref(0);
const searchCurrentIndex = ref(0);

let view: EditorView | null = null;

const debouncedUpdate = debounce((state: EditorState, shouldSyncContent: boolean) => {
  const text = state.doc.toString();
  const wordCount =
    (text.match(/[\u4e00-\u9fa5]/g) || []).length +
    (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9_-]+/g) || []).length;

  const outline: { text: string; level: number; pos: number }[] = [];
  let pos = 0;
  for (const line of text.split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      outline.push({ text: match[2], level: match[1].length, pos });
    }
    pos += line.length + 1;
  }

  const head = state.selection.main.head;
  const lineInfo = state.doc.lineAt(head);
  const cursor = { line: lineInfo.number, col: head - lineInfo.from + 1 };
  const sel = state.selection.main;
  const selectionText = sel.from !== sel.to ? state.doc.sliceString(sel.from, sel.to) : '';

  emit('update', { wordCount, outline, selectionText, cursor });
  if (shouldSyncContent) {
    fileStore.setContent(text);
  }
}, 300);

function handleContainerClick() {
  view?.focus();
}

function closeSearch() {
  isSearchVisible.value = false;
}

function onSearchQuery(query: string) {
  void query;
  searchMatchCount.value = 0;
  searchCurrentIndex.value = 0;
}

function onSearchCaseSensitive(caseSensitive: boolean) {
  void caseSensitive;
}

function onSearchNext() {}

function onSearchPrev() {}

function onSearchReplace(replacement: string) {
  void replacement;
}

function onSearchReplaceAll(replacement: string) {
  void replacement;
}

onMounted(() => {
  if (!editorRef.value) return;

  const extensions = [
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(defaultHighlightStyle),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        fileStore.markUserEdit();
        debouncedUpdate(update.state, true);
      } else if (update.selectionSet) {
        debouncedUpdate(update.state, false);
      }
    }),
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-content': {
        fontFamily: settingsStore.settings.fontFamily,
        fontSize: `${settingsStore.settings.fontSize}px`,
        lineHeight: String(settingsStore.settings.lineHeight),
        color: 'var(--text-color)',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-color)',
        border: 'none',
        color: '#9ca3af',
      },
    }),
  ];

  if (settingsStore.settings.showLineNumbers) {
    extensions.push(lineNumbers());
  }

  const startState = EditorState.create({
    doc: props.initialContent || '',
    extensions,
  });

  view = new EditorView({
    state: startState,
    parent: editorRef.value,
  });

  debouncedUpdate(view.state, false);
  view.focus();
});

onUnmounted(() => {
  debouncedUpdate.cancel();
  view?.destroy();
  view = null;
});

defineExpose({
  scrollToPos: (pos: number) => {
    if (!view) return;
    const target = Math.max(0, Math.min(pos, view.state.doc.length));
    view.dispatch({
      selection: { anchor: target },
      effects: EditorView.scrollIntoView(target, { y: 'center' }),
    });
  },
  getContent: () => view?.state.doc.toString() ?? '',
  getDoc: () => parseMarkdown(view?.state.doc.toString() ?? '', mySchema),
  getEditorView: () => view,
  openSearch: (_showReplace = false) => {
    isSearchVisible.value = true;
    searchBarRef.value?.setShowReplace(_showReplace);
  },
  closeSearch,
});
</script>
