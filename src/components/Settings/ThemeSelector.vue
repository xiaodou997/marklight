<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { ThemeId } from '../../themes/types';
import ThemeCard from './ThemeCard.vue';

const settingsStore = useSettingsStore();

const allThemes = computed(() => settingsStore.allThemes);
const activeThemeId = computed(() => settingsStore.settings.activeThemeId);

function selectTheme(id: ThemeId) {
  settingsStore.setColorTheme(id);
}

function isPresetTheme(id: ThemeId): boolean {
  return settingsStore.presetThemes.some((theme) => theme.id === id);
}

function deleteCustomTheme(id: ThemeId) {
  settingsStore.removeCustomTheme(id);
}
</script>

<template>
  <div class="theme-selector">
    <div class="theme-selector-header">
      <div>
        <div class="theme-selector-title">应用主题</div>
        <div class="theme-selector-subtitle">直接选择一个你想要的应用主题。多个主题会以紧凑网格显示。</div>
      </div>
    </div>

    <div class="theme-grid">
      <ThemeCard
        v-for="theme in allThemes"
        :key="theme.id"
        :theme="theme"
        :active="activeThemeId === theme.id"
        :removable="!isPresetTheme(theme.id)"
        @select="selectTheme(theme.id)"
        @delete="deleteCustomTheme(theme.id)"
      />
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

.theme-selector-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted-color);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (min-width: 1280px) {
  .theme-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
