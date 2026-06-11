<script setup lang="ts">
import type { Theme } from '../../themes/types';

defineProps<{
  theme: Theme;
}>();
</script>

<template>
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
      <div class="theme-preview-dot" :style="{ backgroundColor: theme.colors.primaryColor }" />
      <div class="theme-preview-dot" :style="{ backgroundColor: theme.colors.warningColor }" />
      <div class="theme-preview-dot" :style="{ backgroundColor: theme.colors.successColor }" />
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
        <div class="theme-preview-nav" :style="{ backgroundColor: theme.colors.hoverBg }" />
        <div
          class="theme-preview-nav theme-preview-nav--short"
          :style="{ backgroundColor: theme.colors.hoverBg }"
        />
      </div>

      <div class="theme-preview-editor">
        <div class="theme-preview-toolbar" :style="{ borderColor: theme.colors.borderLight }">
          <div class="theme-preview-chip" :style="{ backgroundColor: theme.colors.primaryColor }" />
          <div class="theme-preview-tool" :style="{ backgroundColor: theme.colors.tagBg }" />
          <div
            class="theme-preview-tool theme-preview-tool--small"
            :style="{ backgroundColor: theme.colors.tagBg }"
          />
        </div>

        <div class="theme-preview-body">
          <div class="theme-preview-heading" :style="{ backgroundColor: theme.colors.textColor }" />
          <div class="theme-preview-line" :style="{ backgroundColor: theme.colors.textColor }" />
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
</template>

<style scoped>
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
</style>
