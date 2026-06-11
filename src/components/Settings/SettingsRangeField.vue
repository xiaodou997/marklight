<script setup lang="ts">
defineProps<{
  label: string;
  min: number;
  max: number;
  step: number;
  valueSuffix?: string;
  minLabel?: string;
  maxLabel?: string;
}>();

const model = defineModel<number>({ required: true });
</script>

<template>
  <div class="settings-range-field">
    <label class="settings-range-field__label">
      {{ label }}: {{ model }}{{ valueSuffix ?? '' }}
    </label>
    <input
      v-model.number="model"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      class="settings-range-field__input"
    />
    <div v-if="minLabel || maxLabel" class="settings-range-field__limits">
      <span>{{ minLabel }}</span>
      <span>{{ maxLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.settings-range-field {
  min-width: 0;
}

.settings-range-field__label {
  display: block;
  color: var(--text-color);
  font-size: 14px;
  font-weight: 500;
}

.settings-range-field__input {
  width: 100%;
  height: 8px;
  margin-top: 8px;
  border-radius: 8px;
  appearance: none;
  background-color: var(--border-color);
  accent-color: #3b82f6;
  cursor: pointer;
}

.settings-range-field__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

.settings-range-field__input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.settings-range-field__limits {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--muted-color);
  font-size: 12px;
}
</style>
