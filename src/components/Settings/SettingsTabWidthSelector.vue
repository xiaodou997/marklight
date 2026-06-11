<script setup lang="ts">
const model = defineModel<number>({ required: true });
const widths = [2, 4];
</script>

<template>
  <div class="settings-tab-width-selector">
    <button
      v-for="width in widths"
      :key="width"
      class="settings-tab-width-selector__option"
      :style="
        model === width
          ? 'border-color: var(--primary-color); background-color: rgba(99,102,241,0.08); color: var(--primary-color);'
          : 'border-color: var(--border-color); color: var(--text-color);'
      "
      @click="model = width"
    >
      {{ width }} 空格
    </button>
  </div>
</template>

<style scoped>
.settings-tab-width-selector {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.settings-tab-width-selector__option {
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--bg-color);
  font-size: 14px;
  font-weight: 600;
  transition:
    border-color 0.15s,
    background-color 0.15s,
    color 0.15s;
}

@media (max-width: 960px) {
  .settings-tab-width-selector {
    grid-template-columns: 1fr;
  }
}
</style>
