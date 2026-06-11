<script setup lang="ts">
import type { ThemeColors } from '../../themes/types';

defineProps<{
  colors: ThemeColors;
}>();
</script>

<template>
  <div class="theme-preview-card">
    <div
      class="theme-preview-surface"
      :style="{
        backgroundColor: colors.bgColor,
        borderColor: colors.borderColor,
        color: colors.textColor,
      }"
    >
      <div class="theme-preview-chip" :style="{ backgroundColor: colors.primaryColor }" />
      <div class="theme-preview-text" :style="{ backgroundColor: colors.textColor }" />
      <div
        class="theme-preview-text theme-preview-text--muted"
        :style="{ backgroundColor: colors.textSecondary }"
      />
    </div>
  </div>
</template>

<style scoped>
.theme-preview-card {
  padding: 14px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--sidebar-bg);
}

.theme-preview-surface {
  min-height: 88px;
  padding: 16px;
  border: 1px solid;
  border-radius: var(--radius-lg);
}

.theme-preview-chip {
  width: 56px;
  height: 12px;
  border-radius: 999px;
}

.theme-preview-text {
  width: 78%;
  height: 10px;
  margin-top: 18px;
  border-radius: 999px;
  opacity: 0.9;
}

.theme-preview-text--muted {
  width: 52%;
  margin-top: 10px;
  opacity: 0.55;
}
</style>
