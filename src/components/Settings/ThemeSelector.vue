<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { ThemeAppearance, ThemeId } from '../../themes/types';

const settingsStore = useSettingsStore();

const appearanceFilter = ref<'all' | ThemeAppearance>('all');

const allThemes = computed(() => settingsStore.allThemes);
const activeThemeId = computed(() => settingsStore.settings.activeThemeId);

const filteredThemes = computed(() => {
  if (appearanceFilter.value === 'all') {
    return allThemes.value;
  }

  return allThemes.value.filter((theme) => theme.appearance === appearanceFilter.value);
});

function selectTheme(id: ThemeId) {
  settingsStore.setColorTheme(id);
}

function isPresetTheme(id: ThemeId): boolean {
  return settingsStore.presetThemes.some((theme) => theme.id === id);
}

function deleteCustomTheme(id: ThemeId) {
  settingsStore.removeCustomTheme(id);
}

function getAppearanceLabel(appearance: ThemeAppearance) {
  return appearance === 'dark' ? '深色' : '浅色';
}
</script>

<template>
  <div class="theme-selector">
    <div class="theme-selector-header">
      <div>
        <div class="theme-selector-title">应用主题</div>
        <div class="theme-selector-subtitle">应用只保留一个当前主题，浅色和深色主题独立选择。</div>
      </div>

      <div class="theme-filter-group">
        <button
          v-for="option in [
            { value: 'all', label: '全部' },
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' },
          ]"
          :key="option.value"
          class="theme-filter-btn"
          :class="{ 'theme-filter-btn--active': appearanceFilter === option.value }"
          @click="appearanceFilter = option.value as 'all' | ThemeAppearance"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="theme-grid">
      <div
        v-for="theme in filteredThemes"
        :key="theme.id"
        class="theme-card"
        :class="{ 'theme-card--active': activeThemeId === theme.id }"
        @click="selectTheme(theme.id)"
      >
        <div
          class="theme-preview"
          :style="{
            backgroundColor: theme.colors.bgColor,
            borderColor: theme.colors.borderColor,
            boxShadow: theme.colors.shadowSm,
          }"
        >
          <div
            class="theme-preview-sidebar"
            :style="{ backgroundColor: theme.colors.sidebarBg }"
          />
          <div class="theme-preview-body">
            <div
              class="theme-preview-accent"
              :style="{ backgroundColor: theme.colors.primaryColor }"
            />
            <div
              class="theme-preview-line"
              :style="{ backgroundColor: theme.colors.textColor }"
            />
            <div
              class="theme-preview-line theme-preview-line--muted"
              :style="{ backgroundColor: theme.colors.textSecondary }"
            />
          </div>
        </div>

        <div class="theme-info">
          <div class="theme-name-row">
            <span class="theme-name">{{ theme.name }}</span>
            <span v-if="theme.type === 'custom'" class="theme-badge">自定义</span>
          </div>
          <span class="theme-appearance">{{ getAppearanceLabel(theme.appearance) }}</span>
        </div>

        <button
          v-if="!isPresetTheme(theme.id)"
          class="theme-delete-btn"
          title="删除主题"
          @click.stop="deleteCustomTheme(theme.id)"
        >
          <svg class="theme-delete-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div v-if="activeThemeId === theme.id" class="theme-active-indicator">
          <svg class="theme-active-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-selector {
  padding: 12px;
}

.theme-selector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.theme-selector-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.theme-selector-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted-color);
}

.theme-filter-group {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border-radius: var(--radius-lg);
  background: var(--sidebar-bg);
}

.theme-filter-btn {
  padding: 6px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--muted-color);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.theme-filter-btn--active {
  background: var(--bg-color);
  color: var(--primary-color);
  box-shadow: var(--shadow-sm);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.theme-card {
  position: relative;
  padding: 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
}

.theme-card:hover {
  border-color: var(--primary-color);
  background: var(--hover-bg);
  transform: translateY(-1px);
}

.theme-card--active {
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.theme-preview {
  display: flex;
  gap: 10px;
  min-height: 78px;
  padding: 10px;
  border: 1px solid;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.theme-preview-sidebar {
  width: 22%;
  border-radius: 10px;
}

.theme-preview-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
}

.theme-preview-accent {
  width: 42px;
  height: 12px;
  border-radius: 999px;
}

.theme-preview-line {
  width: 86%;
  height: 8px;
  border-radius: 999px;
  opacity: 0.9;
}

.theme-preview-line--muted {
  width: 64%;
  opacity: 0.5;
}

.theme-info {
  margin-top: 10px;
}

.theme-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-name {
  font-size: 13px;
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

.theme-appearance {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted-color);
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
