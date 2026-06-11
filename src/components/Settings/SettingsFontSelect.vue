<script setup lang="ts">
const model = defineModel<string>({ required: true });

const fontOptions = [
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Source Code Pro', label: 'Source Code Pro' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'Menlo', label: 'Menlo' },
  { value: 'Monaco', label: 'Monaco' },
];
</script>

<template>
  <div class="settings-font-select">
    <label class="settings-font-select__label">字体族</label>
    <select v-model="model" class="settings-font-select__input">
      <option v-for="opt in fontOptions" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.settings-font-select {
  min-width: 0;
}

.settings-font-select__label {
  display: block;
  color: var(--text-color);
  font-size: 14px;
  font-weight: 500;
}

.settings-font-select__input {
  width: 100%;
  margin-top: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-color);
  color: var(--text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.settings-font-select__input:focus {
  border-color: transparent;
  outline: none;
  box-shadow: 0 0 0 2px #3b82f6;
}
</style>
