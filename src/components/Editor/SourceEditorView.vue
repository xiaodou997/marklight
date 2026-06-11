<script setup lang="ts">
defineProps<{
  content: string;
}>();

const emit = defineEmits<{
  (e: 'update-content', content: string): void;
}>();

function handleInput(event: Event) {
  emit('update-content', (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="h-full w-full p-8">
    <textarea
      class="w-full h-full resize-none outline-none font-mono text-sm leading-relaxed p-4 rounded-lg"
      style="
        color: var(--text-color);
        background-color: var(--sidebar-bg);
        border: 1px solid var(--border-color);
      "
      :value="content"
      placeholder="在此输入 Markdown 源码..."
      @input="handleInput"
    ></textarea>
  </div>
</template>
