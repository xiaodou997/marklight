<script setup lang="ts">
export type SettingsTabKey = 'appearance' | 'editor' | 'shortcuts' | 'save' | 'export';

const activeTab = defineModel<SettingsTabKey>({ required: true });

const tabs: Array<{ key: SettingsTabKey; label: string; icon: string }> = [
  { key: 'appearance', label: '外观', icon: '🎨' },
  { key: 'editor', label: '编辑器', icon: '✏️' },
  { key: 'shortcuts', label: '快捷键', icon: '⌨️' },
  { key: 'save', label: '保存', icon: '💾' },
  { key: 'export', label: '导出', icon: '📤' },
];
</script>

<template>
  <nav class="settings-sidebar" style="border-color: var(--border-color)">
    <div class="settings-sidebar-label">偏好设置</div>
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="settings-nav-btn"
      :style="
        activeTab === tab.key
          ? 'background-color: rgba(99,102,241,0.1); color: var(--primary-color);'
          : 'color: var(--text-color);'
      "
      @click="activeTab = tab.key"
    >
      <span>{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.settings-sidebar {
  width: 176px;
  flex-shrink: 0;
  padding: 16px;
  border-right: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-color) 92%, white 8%);
}

.settings-sidebar-label {
  margin-bottom: 12px;
  padding: 0 4px;
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-nav-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 600;
  text-align: left;
  transition: background-color 0.15s;
}

.settings-nav-btn:hover {
  background: var(--hover-bg);
}
</style>
