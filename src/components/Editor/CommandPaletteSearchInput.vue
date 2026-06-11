<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  modelValue: string;
  isCommandMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select-next'): void;
  (e: 'select-prev'): void;
  (e: 'execute-selected'): void;
  (e: 'close'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      return;
    }

    nextTick(() => {
      inputRef.value?.focus();
    });
  },
);
</script>

<template>
  <div class="command-input-wrapper">
    <svg class="command-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
    <input
      ref="inputRef"
      :value="modelValue"
      type="text"
      class="command-input"
      :placeholder="isCommandMode ? '搜索命令...' : '搜索文件... (输入 > 搜索命令)'"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.down.prevent="emit('select-next')"
      @keydown.up.prevent="emit('select-prev')"
      @keydown.enter.prevent="emit('execute-selected')"
      @keydown.esc="emit('close')"
    />
  </div>
</template>

<style scoped>
.command-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.command-input-icon {
  width: 20px;
  height: 20px;
  color: #9ca3af;
  margin-right: 12px;
  flex-shrink: 0;
}

.command-input {
  flex: 1;
  font-size: 16px;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
}
</style>
