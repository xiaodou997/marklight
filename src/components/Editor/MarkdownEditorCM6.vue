<template>
  <div
    class="editor-shell h-full w-full cursor-text transition-colors"
    style="background-color: var(--bg-color);"
    @click="handleContainerClick"
  >
    <div ref="editorRef" class="cm6-editor h-full px-12 py-8 overflow-y-auto outline-none"></div>

    <BubbleMenu ref="bubbleMenuRef" :on-action="onBubbleMenuAction" />
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
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { readFile } from '@tauri-apps/plugin-fs';

import { useFileStore } from '../../stores/file';
import { useSettingsStore } from '../../stores/settings';
import { livePreviewExtension } from './cm6/extensions/live-preview';
import { createCm6ShortcutsExtension } from './cm6/extensions/shortcuts';
import { createImageDropExtension, saveImageAndInsertMarkdown } from './cm6/extensions/image-drop';
import { createSmartPasteExtension } from './cm6/extensions/smart-paste';
import { taskToggleExtension } from './cm6/extensions/task-toggle';
import { codeBlockWidgetExtension } from './cm6/extensions/code-block-widget';
import { mathWidgetExtension } from './cm6/extensions/math-widget';
import { tableWidgetExtension } from './cm6/extensions/table-widget';
import { getCm6BubbleMenuState, handleCm6BubbleMenuAction } from './cm6/extensions/bubble-menu';
import BubbleMenu from './views/BubbleMenu.vue';
import SearchBar from './SearchBar.vue';

const props = defineProps<{ initialContent?: string }>();
const emit = defineEmits<{ (e: 'update', data: any): void }>();

const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const editorRef = ref<HTMLElement | null>(null);
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null);
const bubbleMenuRef = ref<InstanceType<typeof BubbleMenu> | null>(null);

const isSearchVisible = ref(false);
const searchMatchCount = ref(0);
const searchCurrentIndex = ref(0);
const searchQuery = ref('');
const searchCaseSensitive = ref(false);
const searchMatches = ref<Array<{ from: number; to: number }>>([]);

let view: EditorView | null = null;
let unlistenDragDrop: (() => void) | null = null;
const lastHtml5Drop = ref(0);

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

function syncBubbleMenu() {
  if (!view || !bubbleMenuRef.value) return;
  const state = getCm6BubbleMenuState(view);
  bubbleMenuRef.value.update(state.show, state.left, state.top, state.marks, state.linkHref);
}

function onBubbleMenuAction(type: string, data?: { href?: string }) {
  if (!view) return;
  handleCm6BubbleMenuAction(view, type, data);
  view.focus();
  syncBubbleMenu();
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
    createCm6ShortcutsExtension(settingsStore.settings.customShortcuts),
    createImageDropExtension(fileStore, lastHtml5Drop),
    createSmartPasteExtension(),
    taskToggleExtension,
    codeBlockWidgetExtension,
    mathWidgetExtension,
    tableWidgetExtension,
    EditorView.lineWrapping,
    livePreviewExtension,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        fileStore.markUserEdit();
        debouncedUpdate(update.state, true);
        if (searchQuery.value) {
          rebuildSearchMatches();
        }
        syncBubbleMenu();
      } else if (update.selectionSet) {
        debouncedUpdate(update.state, false);
        syncBubbleMenu();
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
  syncBubbleMenu();
  view.focus();

  void (async () => {
    try {
      const webview = getCurrentWebview();
      unlistenDragDrop = await webview.onDragDropEvent(async (event) => {
        const payload = event.payload as { type: string; paths?: string[]; position?: { x: number; y: number } } | undefined;
        if (!payload || payload.type !== 'drop') return;
        if (lastHtml5Drop.value && Date.now() - lastHtml5Drop.value < 800) return;
        const paths = payload.paths || [];
        if (!paths.length || !view) return;
        const imagePath = paths.find((p: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(p));
        if (!imagePath) return;
        const bytes = await readFile(imagePath);
        const name = imagePath.split(/[/\\]/).pop() || 'image';
        const ext = imagePath.split('.').pop()?.toLowerCase() || '';
        const mime = ext === 'png' ? 'image/png' :
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
            ext === 'gif' ? 'image/gif' :
              ext === 'webp' ? 'image/webp' :
                ext === 'svg' ? 'image/svg+xml' :
                  ext === 'bmp' ? 'image/bmp' : 'application/octet-stream';
        const file = new File([bytes], name, { type: mime });
        const insertPos = payload.position ? view.posAtCoords({ x: payload.position.x, y: payload.position.y }) ?? undefined : undefined;
        await saveImageAndInsertMarkdown(view, file, fileStore, name, insertPos);
      });
    } catch {}
  })();
});

onUnmounted(() => {
  debouncedUpdate.cancel();
  bubbleMenuRef.value?.update(false, 0, 0, { bold: false, italic: false, code: false, link: false });
  if (unlistenDragDrop) {
    unlistenDragDrop();
    unlistenDragDrop = null;
  }
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
  getEditorView: () => view,
  openSearch: (_showReplace = false) => {
    isSearchVisible.value = true;
    searchBarRef.value?.setShowReplace(_showReplace);
  },
  closeSearch,
});
</script>
