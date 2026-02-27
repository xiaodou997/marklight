<template>
  <div class="outline-container h-full overflow-y-auto p-4 select-none">
    <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">大纲</h3>
    <div v-if="items.length === 0" class="text-xs text-gray-400 px-2 italic">
      暂无标题
    </div>
    <nav class="space-y-1">
      <div
        v-for="item in items"
        :key="item.pos"
        @click="$emit('item-click', item.pos)"
        :style="{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }"
        class="group flex items-center py-1.5 px-2 rounded-md text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors"
      >
        <span class="truncate">{{ item.text }}</span>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
export interface OutlineItem {
  text: string;
  level: number;
  pos: number;
}

defineProps<{
  items: OutlineItem[];
}>();

defineEmits<{
  (e: 'item-click', pos: number): void;
}>();
</script>
