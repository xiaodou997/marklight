<script setup lang="ts">
defineEmits<{
  close: [];
  reset: [];
}>();
</script>

<template>
  <div
    class="settings-footer"
    style="border-color: var(--border-color); background-color: var(--sidebar-bg)"
  >
    <button class="settings-footer-reset" style="color: var(--muted-color)" @click="$emit('reset')">
      恢复默认
    </button>
    <button class="settings-footer-done" @click="$emit('close')">完成</button>
  </div>
</template>

<style scoped>
.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -1px 0 rgba(15, 23, 42, 0.02);
}

.settings-footer-reset {
  padding: 8px 16px;
  font-size: 14px;
  transition: color 0.15s;
}

.settings-footer-done {
  padding: 8px 24px;
  border-radius: 8px;
  background: #3b82f6;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.15s;
}

.settings-footer-done:hover {
  background: #2563eb;
}
</style>
