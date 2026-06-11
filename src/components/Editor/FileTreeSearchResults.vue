<script setup lang="ts">
import type { TreeNode } from '../../composables/useWorkspaceSession';
import FileTreeNode from './FileTreeNode.vue';

defineProps<{
  nodes: TreeNode[];
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
  <div v-if="nodes.length === 0" class="px-4 py-3 text-xs text-gray-400 italic">
    没有匹配的文件
  </div>
  <FileTreeNode
    v-for="node in nodes"
    :key="node.path"
    :node="node"
    :current-file-path="currentFilePath"
    :show-toggle="false"
    @select="handleSelect"
    @context-menu="handleContextMenu"
  />
</template>
