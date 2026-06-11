<script setup lang="ts">
import type { ThemeColors } from '../../themes/types';
import type { ThemeColorGroup } from './theme-editor-types';

defineProps<{
  colors: ThemeColors;
  groups: ThemeColorGroup[];
}>();

const emit = defineEmits<{
  (e: 'update-color', key: keyof ThemeColors, value: string): void;
}>();

function formatColorLabel(key: keyof ThemeColors) {
  return key
    .replace(/Color|Bg|Border|Shadow|Hover|Light|Secondary/g, (match) => ` ${match}`)
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}
</script>

<template>
  <div class="color-groups">
    <div v-for="group in groups" :key="group.name" class="color-group">
      <div class="color-group-name">{{ group.name }}</div>
      <div class="color-items">
        <div v-for="key in group.keys" :key="key" class="color-item">
          <label class="color-label">{{ formatColorLabel(key) }}</label>
          <div class="color-input-wrapper">
            <input
              type="color"
              :value="colors[key]"
              class="color-input"
              @input="emit('update-color', key, ($event.target as HTMLInputElement).value)"
            />
            <input
              type="text"
              :value="colors[key]"
              class="color-text-input"
              @input="emit('update-color', key, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.color-group {
  padding: 14px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--bg-color);
}

.color-group-name {
  margin-bottom: 12px;
  color: var(--text-color);
  font-size: 13px;
  font-weight: 600;
}

.color-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.color-label {
  color: var(--muted-color);
  font-size: 12px;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
}

.color-input {
  width: 40px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: none;
}

.color-text-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--input-bg);
  color: var(--text-color);
  font-family: 'SFMono-Regular', 'JetBrains Mono', monospace;
}
</style>
