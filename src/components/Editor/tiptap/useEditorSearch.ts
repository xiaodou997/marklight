import { ref, type Ref } from 'vue';
import type { Editor as TiptapEditor } from '@tiptap/vue-3';

interface SearchMatch {
  from: number;
  to: number;
}

export function useEditorSearch(editor: Ref<TiptapEditor | null>) {
  const isSearchVisible = ref(false);
  const searchMatchCount = ref(0);
  const searchCurrentIndex = ref(0);

  let searchQuery = '';
  let caseSensitive = false;
  let currentMatches: SearchMatch[] = [];

  function findMatches(query: string): SearchMatch[] {
    if (!editor.value || !query) return [];
    const doc = editor.value.state.doc;
    const results: SearchMatch[] = [];
    const searchText = caseSensitive ? query : query.toLowerCase();

    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const text = caseSensitive ? node.text : node.text.toLowerCase();
      let index = 0;
      while ((index = text.indexOf(searchText, index)) !== -1) {
        results.push({ from: pos + index, to: pos + index + query.length });
        index += 1;
      }
    });
    return results;
  }

  function scrollToMatch(index: number) {
    if (!editor.value || index < 0 || index >= currentMatches.length) return;
    const match = currentMatches[index];
    editor.value.commands.setTextSelection(match);
    const dom = editor.value.view.domAtPos(match.from);
    const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function onSearchQuery(query: string) {
    searchQuery = query;
    currentMatches = findMatches(query);
    searchMatchCount.value = currentMatches.length;
    searchCurrentIndex.value = currentMatches.length > 0 ? 1 : 0;
    if (currentMatches.length > 0) scrollToMatch(0);
  }

  function onSearchCaseSensitive(sensitive: boolean) {
    caseSensitive = sensitive;
    onSearchQuery(searchQuery);
  }

  function onSearchNext() {
    if (searchMatchCount.value === 0) return;
    searchCurrentIndex.value =
      searchCurrentIndex.value >= searchMatchCount.value ? 1 : searchCurrentIndex.value + 1;
    scrollToMatch(searchCurrentIndex.value - 1);
  }

  function onSearchPrev() {
    if (searchMatchCount.value === 0) return;
    searchCurrentIndex.value =
      searchCurrentIndex.value <= 1 ? searchMatchCount.value : searchCurrentIndex.value - 1;
    scrollToMatch(searchCurrentIndex.value - 1);
  }

  function onSearchReplace(replacement: string) {
    if (!editor.value || currentMatches.length === 0) return;
    const idx = searchCurrentIndex.value - 1;
    if (idx < 0 || idx >= currentMatches.length) return;
    const match = currentMatches[idx];

    editor.value
      .chain()
      .focus()
      .setTextSelection(match)
      .deleteSelection()
      .insertContent(replacement)
      .run();

    currentMatches = findMatches(searchQuery);
    searchMatchCount.value = currentMatches.length;
    if (searchCurrentIndex.value > currentMatches.length) {
      searchCurrentIndex.value = currentMatches.length > 0 ? 1 : 0;
    }
    if (currentMatches.length > 0) scrollToMatch(searchCurrentIndex.value - 1);
  }

  function onSearchReplaceAll(replacement: string) {
    if (!editor.value || currentMatches.length === 0) return;
    const matches = [...currentMatches].reverse();
    const chain = editor.value.chain();
    for (const match of matches) {
      chain.setTextSelection(match).deleteSelection().insertContent(replacement);
    }
    chain.run();

    currentMatches = findMatches(searchQuery);
    searchMatchCount.value = currentMatches.length;
    searchCurrentIndex.value = 0;
  }

  function openSearch() {
    isSearchVisible.value = true;
  }

  function closeSearch() {
    isSearchVisible.value = false;
    searchMatchCount.value = 0;
    searchCurrentIndex.value = 0;
    searchQuery = '';
  }

  return {
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
  };
}
