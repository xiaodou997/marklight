<script setup lang="ts">
import { WECHAT_THEMES } from '../../utils/wechat-themes';

const model = defineModel<string>({ required: true });
</script>

<template>
  <div class="wechat-theme-grid">
    <button
      v-for="theme in WECHAT_THEMES"
      :key="theme.id"
      class="wechat-theme-card"
      :style="
        model === theme.id
          ? 'border-color: var(--primary-color); background-color: rgba(99,102,241,0.08);'
          : 'border-color: var(--border-color);'
      "
      @click="model = theme.id"
    >
      <div class="wechat-theme-card__header">
        <span class="wechat-theme-card__dot" :style="{ backgroundColor: theme.colors.primary }" />
        <span class="wechat-theme-card__name" style="color: var(--text-color)">
          {{ theme.name }}
        </span>
      </div>
      <div class="wechat-theme-card__swatches">
        <span class="wechat-theme-card__swatch" :style="{ backgroundColor: theme.colors.primary }" />
        <span
          class="wechat-theme-card__swatch"
          :style="{ backgroundColor: theme.colors.primaryDark }"
        />
        <span class="wechat-theme-card__swatch" :style="{ backgroundColor: theme.colors.codeBg }" />
      </div>
    </button>
  </div>
</template>

<style scoped>
.wechat-theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.wechat-theme-card {
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  text-align: left;
  transition:
    border-color 0.15s,
    background-color 0.15s;
}

.wechat-theme-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.wechat-theme-card__dot {
  width: 16px;
  height: 16px;
  border-radius: 999px;
}

.wechat-theme-card__name {
  font-size: 14px;
  font-weight: 500;
}

.wechat-theme-card__swatches {
  display: flex;
  gap: 4px;
}

.wechat-theme-card__swatch {
  width: 24px;
  height: 8px;
  border-radius: 4px;
}
</style>
