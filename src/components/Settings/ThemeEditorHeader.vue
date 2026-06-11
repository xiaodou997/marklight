<script setup lang="ts">
import type { ThemeAppearance } from '../../themes/types';

defineProps<{
  themeName: string;
  appearance: ThemeAppearance;
  intro: string;
}>();

const emit = defineEmits<{
  (e: 'update-theme-name', value: string): void;
  (e: 'export'): void;
  (e: 'import', event: Event): void;
}>();

function getAppearanceLabel(appearance: ThemeAppearance) {
  return appearance === 'dark' ? '深色主题' : '浅色主题';
}
</script>

<template>
  <div class="theme-editor-header">
    <div class="theme-editor-heading">
      <input
        :value="themeName"
        type="text"
        class="theme-name-input"
        placeholder="主题名称"
        @input="emit('update-theme-name', ($event.target as HTMLInputElement).value)"
      />
      <span class="theme-appearance-badge">{{ getAppearanceLabel(appearance) }}</span>
      <p class="theme-editor-intro">{{ intro }}</p>
    </div>
    <div class="theme-editor-actions">
      <button class="theme-action-btn" title="导出" @click="emit('export')">
        <svg class="theme-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      </button>
      <label class="theme-action-btn" title="导入">
        <svg class="theme-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <input type="file" accept=".json" class="hidden" @change="emit('import', $event)" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.theme-editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.theme-editor-heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.theme-name-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--input-bg);
  color: var(--text-color);
  font-size: 14px;
  outline: none;
}

.theme-name-input:focus {
  border-color: var(--input-focus-border);
  box-shadow: var(--input-focus-shadow);
}

.theme-appearance-badge {
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
}

.theme-editor-intro {
  margin: 0;
  color: var(--muted-color);
  font-size: 12px;
  line-height: 1.6;
}

.theme-editor-actions {
  display: flex;
  gap: 8px;
}

.theme-action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-color);
  color: var(--text-color);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.theme-action-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
}

.theme-action-icon {
  width: 18px;
  height: 18px;
}
</style>
