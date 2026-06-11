<script setup lang="ts">
import type { TreeNode } from '../../composables/useWorkspaceSession';
import FileTreeNode from './FileTreeNode.vue';

defineProps<{
  items: Array<{ node: TreeNode; depth: number }>;
  currentFilePath: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', node: TreeNode, event: MouseEvent): void;
  (e: 'context-menu', event: MouseEvent, node: TreeNode): void;
}>();

function handleSelect(node: TreeNode, event: MouseEvent) {
  emit('select', node, event);
}

function handleContextMenu(event: MouseEvent, node: TreeNode) {
  emit('context-menu', event, node);
}
</script>

<template>
  <div v-if="items.length === 0" class="px-4 py-3 text-xs text-gray-400 italic">
    当前文件夹为空
  </div>
  <FileTreeNode
    v-for="{ node, depth } in items"
    :key="node.path"
    :node="node"
    :depth="depth"
    :current-file-path="currentFilePath"
    @select="handleSelect"
    @context-menu="handleContextMenu"
  />
</template>
