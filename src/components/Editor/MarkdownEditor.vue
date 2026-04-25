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
import { onMounted, ref, watch, shallowRef, onBeforeUnmount } from 'vue';
import { debounce } from 'lodash-es';
import { Editor as TiptapEditor, EditorContent } from '@tiptap/vue-3';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { getCurrentWebview } from '@tauri-apps/api/webview';

import { useFileStore } from '../../stores/file';
import { importDocumentImage } from '../../services/tauri/document';
import { useSettingsStore } from '../../stores/settings';
import { parseMarkdown } from './tiptap/markdown/parser';
import { serializeMarkdown } from './tiptap/markdown/serializer';
import { CustomCodeBlock } from './tiptap/extensions/code-block';
import { HeadingMarker, HeadingWithMarker } from './tiptap/extensions/heading-marker';
import {
  BoldOpen,
  BoldClose,
  ItalicOpen,
  ItalicClose,
  StrikeOpen,
  StrikeClose,
  HighlightOpen,
  HighlightClose,
  SupOpen,
  SupClose,
  SubOpen,
  SubClose,
  CodeOpen,
  CodeClose,
  MarkTokenSync,
} from './tiptap/extensions/mark-tokens';
import {
  CustomTable,
  CustomTableRow,
  CustomTableHeader,
  CustomTableCell,
} from './tiptap/extensions/table';
import { CustomImage } from './tiptap/extensions/image';
import { MathBlock } from './tiptap/extensions/math-block';
import { MathInline } from './tiptap/extensions/math-inline';
import { MermaidBlock } from './tiptap/extensions/mermaid-block';
import { Callout } from './tiptap/extensions/callout';
import { Frontmatter } from './tiptap/extensions/frontmatter';
import { MarkdownInputRules } from './tiptap/extensions/input-rules';
import {
  LinkBracketOpen,
  LinkBracketClose,
  LinkUrl,
  LinkTokenSync,
} from './tiptap/extensions/link-token';
import { Superscript, Subscript } from './tiptap/extensions/sub-sup';
import { Wikilink } from './tiptap/extensions/wikilink';
import {
  SlashCommands,
  slashCommandItems,
  type SlashCommandItem,
} from './tiptap/extensions/slash-commands';
import { DragHandle } from './tiptap/extensions/drag-handle';
import BubbleMenuComponent from './views/BubbleMenu.vue';
import SlashMenu from './views/SlashMenu.vue';
import SearchBar from './SearchBar.vue';
import './tiptap/editor.css';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

type SlashCommandSuggestionProps = SuggestionProps<SlashCommandItem, SlashCommandItem>;

// 深色模式 highlight.js 主题切换
const hljsDarkCssId = 'hljs-dark-theme';
function syncHljsTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  let el = document.getElementById(hljsDarkCssId) as HTMLLinkElement | null;
  if (isDark) {
    if (!el) {
      el = document.createElement('link');
      el.id = hljsDarkCssId;
      el.rel = 'stylesheet';
      el.href = new URL('highlight.js/styles/github-dark.css', import.meta.url).href;
      document.head.appendChild(el);
    }
  } else {
    el?.remove();
  }
}

const props = defineProps<{ initialContent?: string }>();
const emit = defineEmits<{ (e: 'update', data: any): void }>();

const fileStore = useFileStore();
const settingsStore = useSettingsStore();
const editorWrapRef = ref<HTMLElement | null>(null);
const bubbleMenuRef = ref<InstanceType<typeof BubbleMenuComponent> | null>(null);
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null);
const slashMenuRef = ref<InstanceType<typeof SlashMenu> | null>(null);
const slashMenuItems = ref<SlashCommandItem[]>([]);
const slashMenuCommand = ref<(item: SlashCommandItem) => void>(() => {});
const customCssId = 'marklight-custom-editor-css';

// 搜索状态
const isSearchVisible = ref(false);
const searchMatchCount = ref(0);
const searchCurrentIndex = ref(0);

function injectCustomCSS(css: string) {
  let el = document.getElementById(customCssId) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = customCssId;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

watch(() => settingsStore.settings.customEditorCSS, injectCustomCSS, { immediate: true });

// ── 创建 TipTap Editor ────────────────────────────────────────

const editor = shallowRef<TiptapEditor | null>(null);

function createEditor(content: string) {
  if (editor.value) {
    editor.value.destroy();
  }

  const e = new TiptapEditor({
    extensions: [
      StarterKit.configure({
        // 禁用 StarterKit 内置的 codeBlock，使用 CodeBlockLowlight
        codeBlock: false,
        // 禁用 StarterKit 内置的 link，下面单独配置
        link: false,
        // 禁用 StarterKit 内置的 heading，使用方案 C 的自定义 heading + marker
        heading: false,
      }),
      HeadingMarker,
      HeadingWithMarker,
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
      MarkdownInputRules,
      LinkBracketOpen,
      LinkBracketClose,
      LinkUrl,
      LinkTokenSync,
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
      // Phase A/B: mark token 实体化
      BoldOpen,
      BoldClose,
      ItalicOpen,
      ItalicClose,
      StrikeOpen,
      StrikeClose,
      HighlightOpen,
      HighlightClose,
      SupOpen,
      SupClose,
      SubOpen,
      SubClose,
      CodeOpen,
      CodeClose,
      MarkTokenSync,
    ],
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

  // 统计信息
  const text = ed.state.doc.textContent;
  const wordCount = text.replace(/\s+/g, '').length;

  // 大纲提取
  const outline = extractOutline(ed);

  emit('update', { wordCount, outline });
}, 300);

function emitCursorInfo(ed: TiptapEditor) {
  const { from } = ed.state.selection;
  const resolved = ed.state.doc.resolve(from);
  // 计算行号和列号
  let line = 1;
  ed.state.doc.descendants((node, nodePos) => {
    if (node.isBlock && nodePos < from) {
      line++;
    }
    return nodePos < from;
  });
  const col = from - resolved.start(resolved.depth) + 1;

  const sel = ed.state.selection;
  const selectionText = sel.empty ? '' : ed.state.doc.textBetween(sel.from, sel.to, '\n');

  emit('update', {
    cursor: { line, col },
    selectionText,
  });
}

function extractOutline(ed: TiptapEditor): Array<{ level: number; text: string; pos: number }> {
  const outline: Array<{ level: number; text: string; pos: number }> = [];
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      // 跳过开头的 headingMarker（占 1 个位置），仅保留正文文本
      const text =
        node.firstChild?.type.name === 'headingMarker'
          ? node.textBetween(1, node.content.size)
          : node.textContent;
      outline.push({
        level: node.attrs.level,
        text,
        pos,
      });
    }
  });
  return outline;
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

  const linkHref = ed.getAttributes('link')?.href;

  bubbleMenuRef.value?.update(true, left, top, marks, linkHref);
}

function onBubbleMenuAction(type: string, data?: any) {
  if (!editor.value) return;
  const chain = editor.value.chain().focus();

  switch (type) {
    case 'bold':
      chain.toggleBold().run();
      break;
    case 'italic':
      chain.toggleItalic().run();
      break;
    case 'code':
      chain.toggleCode().run();
      break;
    case 'link':
      if (data?.href) {
        chain.setLink({ href: data.href }).run();
      }
      break;
    case 'unlink':
      chain.unsetLink().run();
      break;
    case 'h1':
      chain.toggleHeading({ level: 1 }).run();
      break;
    case 'h2':
      chain.toggleHeading({ level: 2 }).run();
      break;
  }
}

function executeEditorCommand(commandId: string): boolean {
  if (!editor.value) {
    return false;
  }

  const chain = editor.value.chain().focus();

  switch (commandId) {
    case 'editor.undo':
      return editor.value.commands.undo();
    case 'editor.redo':
      return editor.value.commands.redo();
    case 'editor.bold':
      return chain.toggleBold().run();
    case 'editor.italic':
      return chain.toggleItalic().run();
    case 'editor.strike':
      return chain.toggleStrike().run();
    case 'editor.highlight':
      return chain.toggleHighlight().run();
    case 'editor.code':
      return chain.toggleCode().run();
    case 'editor.heading1':
      return chain.toggleHeading({ level: 1 }).run();
    case 'editor.heading2':
      return chain.toggleHeading({ level: 2 }).run();
    case 'editor.heading3':
      return chain.toggleHeading({ level: 3 }).run();
    case 'editor.heading4':
      return chain.toggleHeading({ level: 4 }).run();
    case 'editor.heading5':
      return chain.toggleHeading({ level: 5 }).run();
    case 'editor.heading6':
      return chain.toggleHeading({ level: 6 }).run();
    case 'editor.paragraph':
      return chain.setParagraph().run();
    case 'editor.bulletList':
      return chain.toggleBulletList().run();
    case 'editor.orderedList':
      return chain.toggleOrderedList().run();
    case 'editor.taskList':
      return chain.toggleTaskList().run();
    case 'editor.blockquote':
      return chain.toggleBlockquote().run();
    case 'editor.codeBlock':
      return chain.toggleCodeBlock().run();
    default:
      return false;
  }
}

// ── 搜索替换 ─────────────────────────────────────────────────

let searchQuery = '';
let caseSensitive = false;
let currentMatches: Array<{ from: number; to: number }> = [];

/** 在 ProseMirror 文档中查找匹配项（精确文档位置） */
function findMatches(query: string): Array<{ from: number; to: number }> {
  if (!editor.value || !query) return [];
  const doc = editor.value.state.doc;
  const results: Array<{ from: number; to: number }> = [];
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

  // 重新搜索
  currentMatches = findMatches(searchQuery);
  searchMatchCount.value = currentMatches.length;
  if (searchCurrentIndex.value > currentMatches.length) {
    searchCurrentIndex.value = currentMatches.length > 0 ? 1 : 0;
  }
  if (currentMatches.length > 0) scrollToMatch(searchCurrentIndex.value - 1);
}

function onSearchReplaceAll(replacement: string) {
  if (!editor.value || currentMatches.length === 0) return;
  // 从后往前替换，避免位置偏移
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

function closeSearch() {
  isSearchVisible.value = false;
  searchMatchCount.value = 0;
  searchCurrentIndex.value = 0;
  searchQuery = '';
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
  try {
    const webview = getCurrentWebview();
    unlistenDragDrop = await webview.onDragDropEvent(async (event) => {
      if (event.payload.type !== 'drop') return;
      const paths = event.payload.paths;
      if (!paths?.length || !editor.value) return;

      const filePath = fileStore.currentFile.path;
      if (!filePath) return;

      for (const imagePath of paths) {
        const ext = imagePath.split('.').pop()?.toLowerCase() || '';
        if (!['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) continue;

        try {
          const savedImage = await importDocumentImage(imagePath, filePath);

          editor.value
            ?.chain()
            .focus()
            .setImage({ src: savedImage.relativePath, alt: '' })
            .run();
        } catch (err) {
          console.error('Failed to handle dropped image:', err);
        }
      }
    });
  } catch (err) {
    console.error('Failed to setup drag-drop:', err);
  }
}

// ── 主题同步 ──────────────────────────────────────────────────

const themeObserver = new MutationObserver(syncHljsTheme);

// ── 生命周期 ──────────────────────────────────────────────────

onMounted(() => {
  createEditor(props.initialContent || '');
  syncHljsTheme();
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  setupDragDrop();
});

onBeforeUnmount(() => {
  debouncedUpdate.cancel();
  editor.value?.destroy();
  editor.value = null;
  themeObserver.disconnect();
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
  executeCommand: executeEditorCommand,
  undo: () => editor.value?.commands.undo(),
  redo: () => editor.value?.commands.redo(),
  openSearch: (_showReplace = false) => {
    isSearchVisible.value = true;
    searchBarRef.value?.setShowReplace(_showReplace);
  },
  closeSearch,
});
</script>
