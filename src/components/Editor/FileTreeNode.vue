<script setup lang="ts">
import { computed } from 'vue';
import type { TreeNode } from '../../composables/useWorkspaceSession';

const props = withDefaults(
  defineProps<{
    node: TreeNode;
    currentFilePath: string | null;
    depth?: number;
    showToggle?: boolean;
  }>(),
  {
    depth: 0,
    showToggle: true,
  },
);

const emit = defineEmits<{
  (e: 'select', node: TreeNode, event: MouseEvent): void;
  (e: 'context-menu', event: MouseEvent, node: TreeNode): void;
}>();

const rowStyle = computed(() => {
  return {
    paddingLeft: `${props.depth * 14 + 8}px`,
  };
});

const rowClasses = computed(() =>
  props.node.path === props.currentFilePath
    ? 'bg-blue-50 text-blue-600'
    : 'text-gray-600 hover:bg-gray-100',
);

const icon = computed(() => {
  if (props.node.is_dir) return props.node.expanded ? '📂' : '📁';
  if (props.node.is_md) return '📝';
  if (props.node.is_image) return '🖼️';
  return '📄';
});
</script>

<template>
  <div
    class="flex items-center py-1 pr-2 text-sm cursor-pointer transition-colors"
    :class="rowClasses"
    :style="rowStyle"
    @click="emit('select', node, $event)"
    @contextmenu.prevent="emit('context-menu', $event, node)"
  >
    <span
      v-if="showToggle"
      class="w-3 flex-shrink-0 text-center mr-0.5 text-xs text-gray-400"
    >
      <template v-if="node.is_dir">{{ node.expanded ? '▾' : '▸' }}</template>
    </span>
    <span class="mr-1.5 text-xs flex-shrink-0">{{ icon }}</span>
    <span class="truncate text-xs">{{ node.name }}</span>
  </div>
</template>
