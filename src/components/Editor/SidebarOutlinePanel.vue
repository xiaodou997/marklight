<script setup lang="ts">
export interface SidebarOutlineItem {
  text: string;
  level: number;
  pos: number;
}

defineProps<{
  items: SidebarOutlineItem[];
}>();

const emit = defineEmits<{
  (e: 'scroll-to', pos: number): void;
}>();
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div v-if="items.length === 0" class="text-xs text-gray-400 px-2 italic">暂无标题</div>
    <nav class="space-y-1">
      <div
        v-for="item in items"
        :key="item.pos"
        :style="{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }"
        class="group flex items-center py-1.5 px-2 rounded-md text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors"
        @click="emit('scroll-to', item.pos)"
      >
        <span class="truncate">{{ item.text }}</span>
      </div>
    </nav>
  </div>
</template>
