<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  badge?: string;
}>();
</script>

<template>
  <div class="settings-page-header">
    <div>
      <h3 class="settings-page-title">{{ title }}</h3>
      <p class="settings-page-desc">{{ description }}</p>
    </div>
    <div v-if="badge" class="settings-page-badge">{{ badge }}</div>
  </div>
</template>

<style scoped>
.settings-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.settings-page-title {
  margin: 0;
  color: var(--text-color);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.settings-page-desc {
  margin: 8px 0 0;
  color: var(--muted-color);
  font-size: 14px;
  line-height: 1.7;
}

.settings-page-badge {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-color);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 960px) {
  .settings-page-header {
    flex-direction: column;
  }
}
</style>
