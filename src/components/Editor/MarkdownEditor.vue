<template>
  <div
    class="editor-shell h-full w-full bg-white cursor-text"
    @click="handleContainerClick"
  >
    <div ref="editorRef" class="prosemirror-editor h-full px-12 py-8 overflow-y-auto outline-none"></div>
    <BubbleMenu ref="bubbleMenuRef" @action="onMenuAction" />
    <TableToolbar ref="tableToolbarRef" @action="onTableAction" />
  </div>
</template>

<script setup lang="ts">
import './core/styles/editor.css';

import { onMounted, onUnmounted, ref, nextTick } from 'vue';
import { debounce } from 'lodash-es';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, selectAll, deleteSelection } from 'prosemirror-commands';
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from 'prosemirror-inputrules';
import { tableEditing, columnResizing } from 'prosemirror-tables';

import { useFileStore } from '../../stores/file';
import { mySchema } from './core/schema';
import { parseMarkdown, serializeMarkdown } from './core/markdown';
import { delimNavPlugin } from './core/plugins/delim-nav';
import { sourceRevealPlugin } from './core/plugins/source-reveal';
import { backspaceCommand } from './core/plugins/backspace';
import { highlightPlugin } from './core/plugins/highlight';
import { createVueNodeView } from './core/nodeViews';
import { createBubbleMenuPlugin, handleMenuAction } from './core/plugins/bubble-menu';
import { createImageHandlePlugin } from './core/plugins/image-handle';
import { createTableToolbarPlugin, handleTableAction } from './core/plugins/table-toolbar';
import { createSmartPastePlugin } from './core/plugins/smart-paste';

import CodeBlockView from './views/CodeBlockView.vue';
import ImageView from './views/ImageView.vue';
import MathView from './views/MathView.vue';
import MermaidView from './views/MermaidView.vue';
import BubbleMenu from './views/BubbleMenu.vue';
import TableToolbar from './views/TableToolbar.vue';

import 'highlight.js/styles/github.css';
import 'prosemirror-tables/style/tables.css';

const props = defineProps<{ initialContent?: string; }>();
const emit = defineEmits<{ (e: 'update', data: any): void; }>();

const fileStore = useFileStore();
const editorRef = ref<HTMLElement | null>(null);
const bubbleMenuRef = ref<InstanceType<typeof BubbleMenu> | null>(null);
const tableToolbarRef = ref<InstanceType<typeof TableToolbar> | null>(null);

let editorView: EditorView | null = null;

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

// 快捷键映射
const myKeymap = keymap({
  "Backspace": backspaceCommand,
  "Mod-z": undo,
  "Mod-y": redo,
  "Mod-Shift-z": redo,
  "Mod-b": toggleMark(mySchema.marks.strong),
  "Mod-i": toggleMark(mySchema.marks.em),
  "Mod-Shift-s": toggleMark(mySchema.marks.strikethrough),
  "Mod-Shift-h": toggleMark(mySchema.marks.highlight),
  "Mod-a": selectAll,
  "Delete": deleteSelection,
  ...baseKeymap
});

const onMenuAction = (type: string) => { if (editorView) handleMenuAction(editorView, type, mySchema); };
const onTableAction = (type: string) => { if (editorView) handleTableAction(editorView, type); };

// 防抖更新统计信息
const debouncedStatsUpdate = debounce((state: EditorState) => {
  if (!editorView) return;

  const { doc, selection } = state;
  const wordCount = doc.textContent.replace(/[\x00-\xff]/g, "m").replace(/m+/g, "*").length;
  const outline: any[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      outline.push({ text: node.textContent, level: node.attrs.level, pos });
    }
  });

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
  fileStore.setContent(serializeMarkdown(doc));
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
        myKeymap,
        myInputRules,
        highlightPlugin,
        delimNavPlugin,
        sourceRevealPlugin,
        createImageHandlePlugin(),
        columnResizing(),
        tableEditing(),
        createSmartPastePlugin(mySchema),
        createBubbleMenuPlugin(mySchema, (show, left, top, marks) => {
          bubbleMenuRef.value?.update(show, left, top, marks);
        }),
        createTableToolbarPlugin((show, left, top) => {
          tableToolbarRef.value?.update(show, left, top);
        })
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
      if (tr.docChanged || tr.selectionSet) {
        debouncedStatsUpdate(newState);
      }
    }
  });

  nextTick(() => editorView?.focus());
});

onUnmounted(() => {
  debouncedStatsUpdate.cancel();
  if (editorView) {
    editorView.destroy();
    editorView = null;
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
    } catch (e) {
      console.error('scrollToPos error:', e);
    }
  },
  getDoc: () => editorView?.state.doc,
  getEditorView: () => editorView
});
</script>
