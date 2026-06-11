<script setup lang="ts">
defineEmits<{
  close: [];
}>();
</script>

<template>
  <div class="settings-modal-header" style="border-color: var(--border-color)">
    <h2 class="settings-modal-title" style="color: var(--text-color)">设置</h2>
    <button class="settings-close-btn" @click="$emit('close')">
      <svg class="settings-close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.settings-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px;
  border-bottom: 1px solid var(--border-color);
}

.settings-modal-title {
  font-size: 18px;
  font-weight: 600;
}

.settings-close-btn {
  padding: 4px;
  border-radius: 12px;
  color: var(--muted-color);
  transition:
    background-color 0.15s,
    color 0.15s;
}

.settings-close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.settings-close-icon {
  width: 20px;
  height: 20px;
}
</style>
