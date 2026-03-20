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
import { livePreviewExtension } from './cm6/extensions/live-preview';
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
const searchQuery = ref('');
const searchCaseSensitive = ref(false);
const searchMatches = ref<Array<{ from: number; to: number }>>([]);

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
  searchQuery.value = '';
  searchMatches.value = [];
  searchMatchCount.value = 0;
  searchCurrentIndex.value = 0;
}

function normalizeForSearch(text: string) {
  return searchCaseSensitive.value ? text : text.toLowerCase();
}

function rebuildSearchMatches() {
  if (!view || !searchQuery.value) {
    searchMatches.value = [];
    searchMatchCount.value = 0;
    searchCurrentIndex.value = 0;
    return;
  }

  const docText = view.state.doc.toString();
  const source = normalizeForSearch(docText);
  const needle = normalizeForSearch(searchQuery.value);
  const matches: Array<{ from: number; to: number }> = [];
  let start = 0;
  while (start <= source.length) {
    const index = source.indexOf(needle, start);
    if (index < 0) break;
    matches.push({ from: index, to: index + needle.length });
    start = index + Math.max(needle.length, 1);
  }

  searchMatches.value = matches;
  searchMatchCount.value = matches.length;
  if (matches.length === 0) {
    searchCurrentIndex.value = 0;
  } else if (searchCurrentIndex.value >= matches.length) {
    searchCurrentIndex.value = matches.length - 1;
  }
}

function selectMatch(index: number) {
  if (!view || searchMatches.value.length === 0) return;
  const safeIndex = ((index % searchMatches.value.length) + searchMatches.value.length) % searchMatches.value.length;
  const match = searchMatches.value[safeIndex];
  searchCurrentIndex.value = safeIndex;
  view.dispatch({
    selection: { anchor: match.from, head: match.to },
    effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
  });
  view.focus();
}

function onSearchQuery(query: string) {
  searchQuery.value = query;
  rebuildSearchMatches();
}

function onSearchCaseSensitive(caseSensitive: boolean) {
  searchCaseSensitive.value = caseSensitive;
  rebuildSearchMatches();
}

function onSearchNext() {
  if (!view || searchMatches.value.length === 0) return;
  const head = view.state.selection.main.to;
  const nextIndex = searchMatches.value.findIndex(m => m.from >= head);
  selectMatch(nextIndex >= 0 ? nextIndex : 0);
}

function onSearchPrev() {
  if (!view || searchMatches.value.length === 0) return;
  const head = view.state.selection.main.from;
  let prevIndex = -1;
  for (let i = 0; i < searchMatches.value.length; i++) {
    if (searchMatches.value[i].to <= head) prevIndex = i;
  }
  selectMatch(prevIndex >= 0 ? prevIndex : searchMatches.value.length - 1);
}

function onSearchReplace(replacement: string) {
  if (!view || searchMatches.value.length === 0) return;
  const index = searchCurrentIndex.value;
  const match = searchMatches.value[index];
  if (!match) return;
  view.dispatch({
    changes: { from: match.from, to: match.to, insert: replacement },
    selection: { anchor: match.from + replacement.length },
  });
  rebuildSearchMatches();
  if (searchMatches.value.length > 0) {
    selectMatch(Math.min(index, searchMatches.value.length - 1));
  }
}

function onSearchReplaceAll(replacement: string) {
  if (!view || searchMatches.value.length === 0) return;
  const changes = searchMatches.value
    .map(match => ({ from: match.from, to: match.to, insert: replacement }))
    .reverse();
  view.dispatch({ changes });
  rebuildSearchMatches();
}

onMounted(() => {
  if (!editorRef.value) return;

  const extensions = [
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(defaultHighlightStyle),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    livePreviewExtension,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        fileStore.markUserEdit();
        debouncedUpdate(update.state, true);
        if (searchQuery.value) {
          rebuildSearchMatches();
        }
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
