<template>
  <div
    class="editor-shell h-full w-full cursor-text transition-colors"
    style="background-color: var(--bg-color);"
    @click="handleContainerClick"
  >
    <div ref="editorRef" class="prosemirror-editor h-full px-12 py-8 overflow-y-auto outline-none"></div>
    
    <!-- 加载中遮罩 -->
    <div v-if="fileStore.isLoading" 
      class="absolute inset-0 flex flex-col items-center justify-center z-50 backdrop-blur-sm"
      style="background-color: var(--bg-color); opacity: 0.8;"
    >
      <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <div class="mt-4 text-xs text-gray-500 font-medium">正在处理文档...</div>
    </div>

    <BubbleMenu ref="bubbleMenuRef" @action="onMenuAction" />
    <TableToolbar ref="tableToolbarRef" @action="onTableAction" />
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
      @close="onSearchClose"
    />
  </div>
</template>

<script setup lang="ts">
import './core/styles/editor.css';

import { onMounted, onUnmounted, ref, nextTick } from 'vue';
import { debounce } from 'lodash-es';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, selectAll, deleteSelection } from 'prosemirror-commands';
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from 'prosemirror-inputrules';
import { tableEditing, columnResizing } from 'prosemirror-tables';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { readFile } from '@tauri-apps/plugin-fs';

import { useFileStore } from '../../stores/file';
import { mySchema } from './core/schema';
import { parseMarkdown, serializeMarkdown } from './core/markdown';
import { delimNavPlugin } from './core/plugins/delim-nav';
import { sourceRevealPlugin } from './core/plugins/source-reveal';
import { backspaceCommand } from './core/plugins/backspace';
import { highlightPlugin } from './core/plugins/highlight';
import { createVueNodeView } from './core/nodeViews';
import { createBubbleMenuPlugin, handleMenuAction } from './core/plugins/bubble-menu';
import { createImageHandlePlugin, saveAndInsertImage } from './core/plugins/image-handle';
import { createTableToolbarPlugin, handleTableAction } from './core/plugins/table-toolbar';
import { createTableNavPlugin } from './core/plugins/table-nav';
import { createSmartPastePlugin } from './core/plugins/smart-paste';
import { createSearchPlugin, getSearchState, setQuery, setCaseSensitive, nextMatch, prevMatch, replaceCurrent, replaceAll, scrollToCurrentMatch, resetSearch } from './core/plugins/search';
import { createLinkTooltipPlugin } from './core/plugins/link-tooltip';
import { createMathPreviewPlugin } from './core/plugins/math-preview';
import { createShortcutsPlugin } from './core/plugins/shortcuts';
import { headingEditPlugin } from './core/plugins/heading-edit';
import { useSettingsStore } from '../../stores/settings';

import CodeBlockView from './views/CodeBlockView.vue';
import ImageView from './views/ImageView.vue';
import MathView from './views/MathView.vue';
import MermaidView from './views/MermaidView.vue';
import BubbleMenu from './views/BubbleMenu.vue';
import TableToolbar from './views/TableToolbar.vue';
import SearchBar from './SearchBar.vue';

import 'highlight.js/styles/github.css';
import 'prosemirror-tables/style/tables.css';

const props = defineProps<{ initialContent?: string; }>();
const emit = defineEmits<{ (e: 'update', data: any): void; }>();

const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const editorRef = ref<HTMLElement | null>(null);
const bubbleMenuRef = ref<InstanceType<typeof BubbleMenu> | null>(null);
const tableToolbarRef = ref<InstanceType<typeof TableToolbar> | null>(null);
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null);

// 搜索状态
const isSearchVisible = ref(false);
const searchMatchCount = ref(0);
const searchCurrentIndex = ref(0);

let editorView: EditorView | null = null;
let unlistenDragDrop: (() => void) | null = null;

function getMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    default: return 'application/octet-stream';
  }
}

// 输入规则
const mathInlineRule = new InputRule(/\$([^$]+)\$$/, (state, match, start, end) => {
  return state.tr.replaceWith(start, end, mySchema.nodes.math_inline.create({ latex: match[1] }));
});
const mathBlockRule = new InputRule(/\$\$\s$/, (state, _match, start, end) => {
  return state.tr.replaceWith(start, end, mySchema.nodes.math_block.create());
});
const headingRule = textblockTypeInputRule(/^#{1,6}\s$/, mySchema.nodes.heading, (match) => ({ level: match[0].trim().length }));
const blockquoteRule = wrappingInputRule(/^\s*>\s$/, mySchema.nodes.blockquote);
const codeBlockRule = textblockTypeInputRule(/^```([a-z]*)\s$/, mySchema.nodes.code_block, (match) => ({ params: match[1] || "" }));

const myInputRules = inputRules({
  rules: [headingRule, blockquoteRule, codeBlockRule, mathInlineRule, mathBlockRule]
});

// 基础快捷键（自定义命令放在后面，覆盖 baseKeymap 中的默认行为）
const myKeymap = keymap({
  ...baseKeymap,
  "Backspace": backspaceCommand,
  "Mod-a": selectAll,
  "Delete": deleteSelection,
});

// 创建快捷键插件（使用自定义快捷键配置）
const shortcutsPlugin = createShortcutsPlugin(mySchema, settingsStore.settings.customShortcuts);
const tableNavPlugin = createTableNavPlugin();

const onMenuAction = (type: string, data?: any) => { if (editorView) handleMenuAction(editorView, type, mySchema, data); };
const onTableAction = (type: string) => { if (editorView) handleTableAction(editorView, type); };

// 缓存大纲数据，实现增量更新
let cachedOutline: any[] = [];
let cachedOutlineVersion = 0;

// 防抖更新统计信息
const debouncedStatsUpdate = debounce((state: EditorState, shouldSyncContent: boolean) => {
  if (!editorView) return;

  const { doc, selection } = state;
  
  // 优化字数计算：匹配中文字符 + 连续的非中文字符作为一个单词
  const text = doc.textContent;
  const wordCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length + 
                    (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9_-]+/g) || []).length;
  
  // 增量更新大纲：只遍历文档一次，使用缓存避免重复计算
  const outline: any[] = [];
  let outlineChanged = false;
  let outlineIndex = 0;

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const headingData = { text: node.textContent, level: node.attrs.level, pos };
      if (outlineIndex < cachedOutline.length) {
        // 比较缓存
        const cached = cachedOutline[outlineIndex];
        if (!cached || cached.text !== headingData.text || cached.level !== headingData.level || cached.pos !== pos) {
          outlineChanged = true;
        }
      } else {
        outlineChanged = true;
      }
      outline.push(headingData);
      outlineIndex++;
    }
  });

  // 如果大纲长度变化，也认为有变化
  if (outline.length !== cachedOutline.length) {
    outlineChanged = true;
  }

  // 只有在大纲变化时才更新缓存
  if (outlineChanged) {
    cachedOutline = outline;
    cachedOutlineVersion++;
  }

  const selectionText = selection instanceof TextSelection
    ? doc.textBetween(selection.from, selection.to)
    : '';

  // 计算光标位置
  const cursor = { line: 1, col: 1 };
  doc.nodesBetween(0, selection.from, (node, pos) => {
    if (node.isText) {
      const offset = selection.from - pos;
      cursor.col = offset + 1;
    } else if (node.isBlock && pos > 0) {
      cursor.line++;
    }
  });

  emit('update', { wordCount, outline, selectionText, cursor });
  if (shouldSyncContent) {
    fileStore.setContent(serializeMarkdown(doc));
  }
}, 400);

const handleContainerClick = (event: MouseEvent) => {
  // 处理任务列表 checkbox 点击
  const target = event.target as HTMLElement;
  if (target.classList.contains('task-checkbox') && editorView) {
    event.preventDefault();
    const { state, dispatch } = editorView;
    
    try {
      // 使用 posAtDOM 直接获取点击位置
      const pos = editorView.posAtDOM(target, 0);
      const $pos = state.doc.resolve(pos);
      
      // 向上寻找 task_item 节点
      for (let d = $pos.depth; d >= 0; d--) {
        const node = $pos.node(d);
        if (node.type.name === 'task_item') {
          const nodePos = $pos.before(d);
          const tr = state.tr.setNodeMarkup(
            nodePos,
            undefined,
            { ...node.attrs, checked: !node.attrs.checked }
          );
          dispatch(tr);
          return;
        }
      }
    } catch (e) {
      console.warn('Task checkbox click handler error:', e);
    }
    return;
  }

  if (editorView && !editorView.hasFocus()) {
    editorView.focus();
  }
};

onMounted(() => {
  if (!editorRef.value) return;

  editorView = new EditorView(editorRef.value, {
    state: EditorState.create({
      schema: mySchema,
      plugins: [
        history(),
        shortcutsPlugin,
        myKeymap,
        myInputRules,
        highlightPlugin,
        delimNavPlugin,
        sourceRevealPlugin,
        headingEditPlugin,
        createImageHandlePlugin(),
        columnResizing(),
        tableEditing(),
        tableNavPlugin,
        createSmartPastePlugin(mySchema),
        createBubbleMenuPlugin(mySchema, (show, left, top, marks, linkHref) => {
          bubbleMenuRef.value?.update(show, left, top, marks, linkHref);
        }),
        createTableToolbarPlugin((show, left, top) => {
          tableToolbarRef.value?.update(show, left, top);
        }),
        createSearchPlugin(),
        createLinkTooltipPlugin(),
        createMathPreviewPlugin()
      ],
      doc: parseMarkdown(props.initialContent || '', mySchema)
    }),
    nodeViews: {
      code_block: (node, view, getPos) => {
        const isMermaid = ['mermaid', 'gantt', 'flow', 'seq'].includes(node.attrs.params);
        return isMermaid
          ? createVueNodeView(MermaidView)(node, view, getPos)
          : createVueNodeView(CodeBlockView)(node, view, getPos);
      },
      image: (node, view, getPos) => {
        return { dom: createVueNodeView(ImageView)(node, view, getPos).dom };
      },
      math_inline: createVueNodeView(MathView),
      math_block: createVueNodeView(MathView)
    },
    dispatchTransaction(tr) {
      if (!editorView) return;
      const newState = editorView.state.apply(tr);
      editorView.updateState(newState);
      if (tr.docChanged) {
        // 文档有实际变化，标记用户编辑
        fileStore.markUserEdit();
        debouncedStatsUpdate(newState, true);
      } else if (tr.selectionSet) {
        debouncedStatsUpdate(newState, false);
      }
    }
  });

  // 立即触发一次统计更新，发送初始大纲数据
  debouncedStatsUpdate(editorView.state, false);
  
  nextTick(() => editorView?.focus());

  // 使用 Tauri 原生拖拽事件作为兜底
  void (async () => {
    try {
      const webview = getCurrentWebview();
      unlistenDragDrop = await webview.onDragDropEvent(async (event) => {
        const payload = event.payload as { type: string; paths?: string[]; position?: { x: number; y: number } } | undefined;
        if (!payload || payload.type !== 'drop') return;
        const lastHtml5Drop = (window as any).__marklightLastHtml5Drop as number | undefined;
        if (lastHtml5Drop && Date.now() - lastHtml5Drop < 800) {
          console.log('[MarkdownEditor] tauri drop ignored (html5 handled)');
          return;
        }
        const paths = payload.paths || [];
        if (!paths.length) return;
        const imagePath = paths.find((p: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(p));
        if (!imagePath) return;
        if (!editorView) return;
        console.log('[MarkdownEditor] tauri drop', { imagePath, position: payload.position });
        try {
          const bytes = await readFile(imagePath);
          const name = imagePath.split(/[/\\]/).pop() || 'image';
          const mime = getMimeFromPath(imagePath);
          const file = new File([bytes], name, { type: mime });
          saveAndInsertImage(editorView, file, fileStore, name);
        } catch (err) {
          console.error('[MarkdownEditor] tauri drop read failed', err);
        }
      });
    } catch (err) {
      console.warn('[MarkdownEditor] onDragDropEvent unavailable', err);
    }
  })();
});

onUnmounted(() => {
  debouncedStatsUpdate.cancel();
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
  if (unlistenDragDrop) {
    unlistenDragDrop();
    unlistenDragDrop = null;
  }
});

defineExpose({
  scrollToPos: (pos: number) => {
    if (!editorView) return;
    try {
      const { doc, tr } = editorView.state;
      const resolvedPos = doc.resolve(pos);
      const selection = TextSelection.near(resolvedPos);
      editorView.dispatch(tr.setSelection(selection).scrollIntoView());
      editorView.focus();
      
      // 额外确保滚动：手动计算位置并滚动
      const coords = editorView.coordsAtPos(pos);
      const editorContainer = editorRef.value;
      if (editorContainer && coords) {
        const containerRect = editorContainer.getBoundingClientRect();
        const scrollTop = editorContainer.scrollTop;
        const targetTop = coords.top - containerRect.top + scrollTop - containerRect.height / 3;
        editorContainer.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth'
        });
      }
    } catch (e) {
      console.error('scrollToPos error:', e);
    }
  },
  getDoc: () => editorView?.state.doc,
  getEditorView: () => editorView,
  // 搜索功能
  openSearch: (showReplace = false) => {
    isSearchVisible.value = true;
    nextTick(() => {
      searchBarRef.value?.setShowReplace(showReplace);
    });
  },
  closeSearch: () => {
    isSearchVisible.value = false;
    if (editorView) {
      editorView.dispatch(resetSearch(editorView.state.tr));
    }
  },
  setSearchQuery: (query: string) => {
    if (!editorView) return;
    editorView.dispatch(setQuery(editorView.state.tr, query));
    updateSearchState();
    scrollToCurrentMatch(editorView);
  },
  setSearchCaseSensitive: (caseSensitive: boolean) => {
    if (!editorView) return;
    editorView.dispatch(setCaseSensitive(editorView.state.tr, caseSensitive));
    updateSearchState();
  },
  searchNext: () => {
    if (!editorView) return;
    editorView.dispatch(nextMatch(editorView.state.tr));
    updateSearchState();
    scrollToCurrentMatch(editorView);
  },
  searchPrev: () => {
    if (!editorView) return;
    editorView.dispatch(prevMatch(editorView.state.tr));
    updateSearchState();
    scrollToCurrentMatch(editorView);
  },
  searchReplace: (replacement: string) => {
    if (!editorView) return;
    replaceCurrent(editorView, replacement);
    updateSearchState();
  },
  searchReplaceAll: (replacement: string) => {
    if (!editorView) return;
    replaceAll(editorView, replacement);
    updateSearchState();
  }
});

// 更新搜索状态
function updateSearchState() {
  if (!editorView) return;
  const state = getSearchState(editorView.state);
  if (state) {
    searchMatchCount.value = state.matches.length;
    searchCurrentIndex.value = state.currentIndex;
  }
}

// 搜索栏事件处理
function onSearchQuery(query: string) {
  if (!editorView) return;
  editorView.dispatch(setQuery(editorView.state.tr, query));
  updateSearchState();
  scrollToCurrentMatch(editorView);
}

function onSearchCaseSensitive(caseSensitive: boolean) {
  if (!editorView) return;
  editorView.dispatch(setCaseSensitive(editorView.state.tr, caseSensitive));
  updateSearchState();
}

function onSearchNext() {
  if (!editorView) return;
  editorView.dispatch(nextMatch(editorView.state.tr));
  updateSearchState();
  scrollToCurrentMatch(editorView);
}

function onSearchPrev() {
  if (!editorView) return;
  editorView.dispatch(prevMatch(editorView.state.tr));
  updateSearchState();
  scrollToCurrentMatch(editorView);
}

function onSearchReplace(replacement: string) {
  if (!editorView) return;
  replaceCurrent(editorView, replacement);
  updateSearchState();
}

function onSearchReplaceAll(replacement: string) {
  if (!editorView) return;
  replaceAll(editorView, replacement);
  updateSearchState();
}

function onSearchClose() {
  isSearchVisible.value = false;
  if (editorView) {
    editorView.dispatch(resetSearch(editorView.state.tr));
  }
  editorView?.focus();
}
</script>
