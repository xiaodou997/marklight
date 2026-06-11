<script setup lang="ts">
import type { Theme } from '../../themes/types';
import ThemePreview from './ThemePreview.vue';

defineProps<{
  theme: Theme;
  active: boolean;
  removable: boolean;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'delete'): void;
}>();
</script>

<template>
  <div class="theme-card" :class="{ 'theme-card--active': active }" @click="emit('select')">
    <ThemePreview :theme="theme" />

    <div class="theme-info">
      <div class="theme-name-row">
        <span class="theme-name">{{ theme.name }}</span>
        <span v-if="theme.type === 'custom'" class="theme-badge">自定义</span>
      </div>
    </div>

    <button
      v-if="removable"
      class="theme-delete-btn"
      title="删除主题"
      @click.stop="emit('delete')"
    >
      <svg class="theme-delete-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>

    <div v-if="active" class="theme-active-indicator">
      <svg class="theme-active-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.theme-card {
  position: relative;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
}

.theme-card:hover {
  border-color: var(--primary-color);
  background: var(--hover-bg);
}

.theme-card--active {
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.theme-info {
  margin-top: 8px;
}

.theme-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color);
}

.theme-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-color);
}

.theme-delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--error-color);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}

.theme-card:hover .theme-delete-btn {
  opacity: 1;
}

.theme-delete-btn:hover {
  background: var(--error-bg);
}

.theme-delete-icon {
  width: 14px;
  height: 14px;
}

.theme-active-indicator {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--primary-color);
}

.theme-active-icon {
  width: 14px;
  height: 14px;
  color: white;
}
</style>
