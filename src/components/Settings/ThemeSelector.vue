<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { ThemeId } from '../../themes/types';

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
      <div
        v-for="theme in allThemes"
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
            boxShadow: theme.colors.shadowMd,
          }"
        >
          <div
            class="theme-preview-topbar"
            :style="{ backgroundColor: theme.colors.bgSecondary, borderColor: theme.colors.borderLight }"
          >
            <div
              class="theme-preview-dot"
              :style="{ backgroundColor: theme.colors.primaryColor }"
            />
            <div
              class="theme-preview-dot"
              :style="{ backgroundColor: theme.colors.warningColor }"
            />
            <div
              class="theme-preview-dot"
              :style="{ backgroundColor: theme.colors.successColor }"
            />
          </div>
          <div class="theme-preview-shell">
            <div
              class="theme-preview-sidebar"
              :style="{ backgroundColor: theme.colors.sidebarBg, borderColor: theme.colors.borderLight }"
            >
              <div
                class="theme-preview-nav theme-preview-nav--active"
                :style="{ backgroundColor: theme.colors.selectedBg }"
              />
              <div
                class="theme-preview-nav"
                :style="{ backgroundColor: theme.colors.hoverBg }"
              />
              <div
                class="theme-preview-nav theme-preview-nav--short"
                :style="{ backgroundColor: theme.colors.hoverBg }"
              />
            </div>

            <div class="theme-preview-editor">
              <div
                class="theme-preview-toolbar"
                :style="{ borderColor: theme.colors.borderLight }"
              >
                <div
                  class="theme-preview-chip"
                  :style="{ backgroundColor: theme.colors.primaryColor }"
                />
                <div
                  class="theme-preview-tool"
                  :style="{ backgroundColor: theme.colors.tagBg }"
                />
                <div
                  class="theme-preview-tool theme-preview-tool--small"
                  :style="{ backgroundColor: theme.colors.tagBg }"
                />
              </div>

              <div class="theme-preview-body">
                <div
                  class="theme-preview-heading"
                  :style="{ backgroundColor: theme.colors.textColor }"
                />
                <div
                  class="theme-preview-line"
                  :style="{ backgroundColor: theme.colors.textColor }"
                />
                <div
                  class="theme-preview-line theme-preview-line--muted"
                  :style="{ backgroundColor: theme.colors.textSecondary }"
                />
                <div
                  class="theme-preview-callout"
                  :style="{ backgroundColor: theme.colors.calloutTipBg }"
                >
                  <div
                    class="theme-preview-callout-bar"
                    :style="{ backgroundColor: theme.colors.calloutTip }"
                  />
                  <div class="theme-preview-callout-content">
                    <div
                      class="theme-preview-callout-line"
                      :style="{ backgroundColor: theme.colors.textColor }"
                    />
                    <div
                      class="theme-preview-callout-line theme-preview-callout-line--short"
                      :style="{ backgroundColor: theme.colors.textSecondary }"
                    />
                  </div>
                </div>
                <div
                  class="theme-preview-code"
                  :style="{ backgroundColor: theme.colors.codeBg, borderColor: theme.colors.codeBorder }"
                >
                  <div
                    class="theme-preview-code-line"
                    :style="{ backgroundColor: theme.colors.primaryColor }"
                  />
                  <div
                    class="theme-preview-code-line theme-preview-code-line--muted"
                    :style="{ backgroundColor: theme.colors.textSecondary }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="theme-info">
          <div class="theme-name-row">
            <span class="theme-name">{{ theme.name }}</span>
            <span v-if="theme.type === 'custom'" class="theme-badge">自定义</span>
          </div>
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

.theme-preview {
  display: flex;
  flex-direction: column;
  min-height: 122px;
  border: 1px solid;
  border-radius: 12px;
  overflow: hidden;
}

.theme-preview-topbar {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 18px;
  padding: 0 8px;
  border-bottom: 1px solid;
}

.theme-preview-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  opacity: 0.9;
}

.theme-preview-shell {
  display: flex;
  min-height: 103px;
}

.theme-preview-sidebar {
  width: 24%;
  padding: 9px 7px;
  border-right: 1px solid;
}

.theme-preview-nav {
  height: 7px;
  margin-bottom: 7px;
  border-radius: 999px;
  opacity: 0.8;
}

.theme-preview-nav--active {
  width: 92%;
}

.theme-preview-nav--short {
  width: 62%;
}

.theme-preview-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.theme-preview-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border-bottom: 1px solid;
}

.theme-preview-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
}

.theme-preview-chip {
  width: 28px;
  height: 8px;
  border-radius: 999px;
}

.theme-preview-tool {
  width: 14px;
  height: 8px;
  border-radius: 999px;
  opacity: 0.9;
}

.theme-preview-tool--small {
  width: 10px;
}

.theme-preview-heading {
  width: 54%;
  height: 8px;
  border-radius: 999px;
}

.theme-preview-line {
  width: 88%;
  height: 6px;
  border-radius: 999px;
  opacity: 0.9;
}

.theme-preview-line--muted {
  width: 64%;
  opacity: 0.5;
}

.theme-preview-callout {
  display: flex;
  gap: 6px;
  align-items: stretch;
  min-height: 18px;
  padding: 4px 5px;
  border-radius: 7px;
}

.theme-preview-callout-bar {
  width: 3px;
  border-radius: 999px;
}

.theme-preview-callout-content {
  flex: 1;
}

.theme-preview-callout-line {
  width: 74%;
  height: 4px;
  margin-top: 2px;
  border-radius: 999px;
  opacity: 0.9;
}

.theme-preview-callout-line--short {
  width: 48%;
  opacity: 0.55;
}

.theme-preview-code {
  padding: 5px 6px;
  border: 1px solid;
  border-radius: 7px;
}

.theme-preview-code-line {
  width: 62%;
  height: 4px;
  border-radius: 999px;
  opacity: 0.95;
}

.theme-preview-code-line--muted {
  width: 82%;
  margin-top: 4px;
  opacity: 0.45;
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

@media (min-width: 1280px) {
  .theme-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
