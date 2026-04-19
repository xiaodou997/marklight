<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { ThemeId } from '../../themes/types';

const settingsStore = useSettingsStore();

// 所有可用主题
const allThemes = computed(() => settingsStore.allThemes);

// 当前选中的主题
const activeThemeId = computed(() => settingsStore.settings.activeThemeId);

// 选择主题
function selectTheme(id: ThemeId) {
  settingsStore.setColorTheme(id);
}

// 判断是否是预设主题
function isPresetTheme(id: ThemeId): boolean {
  return settingsStore.presetThemes.some(t => t.id === id);
}

// 删除自定义主题
function deleteCustomTheme(id: ThemeId) {
  settingsStore.removeCustomTheme(id);
}
</script>

<template>
  <div class="theme-selector">
    <div class="theme-selector-header">
      <span class="theme-selector-title">颜色主题</span>
    </div>

    <div class="theme-grid">
      <div
        v-for="theme in allThemes"
        :key="theme.id"
        class="theme-card"
        :class="{ 'theme-card--active': activeThemeId === theme.id }"
        @click="selectTheme(theme.id)"
      >
        <!-- 主题预览 -->
        <div class="theme-preview">
          <div
            class="theme-preview-light"
            :style="{ backgroundColor: theme.light.bgColor, borderColor: theme.light.borderColor }"
          >
            <div
              class="theme-preview-accent"
              :style="{ backgroundColor: theme.light.primaryColor }"
            ></div>
          </div>
          <div
            class="theme-preview-dark"
            :style="{ backgroundColor: theme.dark.bgColor, borderColor: theme.dark.borderColor }"
          >
            <div
              class="theme-preview-accent"
              :style="{ backgroundColor: theme.dark.primaryColor }"
            ></div>
          </div>
        </div>

        <!-- 主题信息 -->
        <div class="theme-info">
          <span class="theme-name">{{ theme.name }}</span>
          <span v-if="theme.type === 'custom'" class="theme-badge">自定义</span>
        </div>

        <!-- 删除按钮（仅自定义主题） -->
        <button
          v-if="!isPresetTheme(theme.id)"
          class="theme-delete-btn"
          @click.stop="deleteCustomTheme(theme.id)"
          title="删除主题"
        >
          <svg class="theme-delete-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- 激活指示器 -->
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
  margin-bottom: 16px;
}

.theme-selector-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.theme-card {
  position: relative;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-color);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.theme-card:hover {
  border-color: var(--primary-color);
  background-color: var(--hover-bg);
}

.theme-card--active {
  border-color: var(--primary-color);
  background-color: var(--primary-light);
}

.theme-preview {
  display: flex;
  gap: 4px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 8px;
}

.theme-preview-light,
.theme-preview-dark {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid;
}

.theme-preview-accent {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.theme-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
}

.theme-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.theme-delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px;
  border-radius: var(--radius-sm);
  background-color: transparent;
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}

.theme-card:hover .theme-delete-btn {
  opacity: 1;
}

.theme-delete-btn:hover {
  background-color: var(--error-bg);
}

.theme-delete-icon {
  width: 14px;
  height: 14px;
  color: var(--error-color);
}

.theme-active-indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--primary-color);
}

.theme-active-icon {
  width: 12px;
  height: 12px;
  color: var(--btn-primary-text);
}
</style>