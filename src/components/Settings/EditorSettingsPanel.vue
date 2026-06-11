<script setup lang="ts">
import SettingsSwitch from './SettingsSwitch.vue';
import SettingsTabWidthSelector from './SettingsTabWidthSelector.vue';

const showLineNumbers = defineModel<boolean>('showLineNumbers', { required: true });
const spellCheck = defineModel<boolean>('spellCheck', { required: true });
const outlineExpanded = defineModel<boolean>('outlineExpanded', { required: true });
const tabWidth = defineModel<number>('tabWidth', { required: true });
</script>

<template>
  <div class="editor-settings-panel">
    <section class="settings-section-card settings-section-card--hero">
      <div>
        <div class="settings-section-title">编辑器行为</div>
        <p class="settings-section-desc">控制行号、拼写检查和侧边栏大纲等核心编辑体验。</p>
      </div>
      <div class="settings-hero-metrics">
        <div class="settings-hero-chip">Tab：{{ tabWidth }} 空格</div>
        <div class="settings-hero-chip">拼写检查：{{ spellCheck ? '开启' : '关闭' }}</div>
      </div>
    </section>

    <section class="settings-section-card">
      <div class="settings-row">
        <div>
          <label class="settings-row-title">显示行号</label>
          <p class="settings-row-desc">在编辑器左侧显示行号</p>
        </div>
        <SettingsSwitch v-model="showLineNumbers" label="切换显示行号" />
      </div>

      <div class="settings-row">
        <div>
          <label class="settings-row-title">拼写检查</label>
          <p class="settings-row-desc">启用系统拼写检查</p>
        </div>
        <SettingsSwitch v-model="spellCheck" label="切换拼写检查" />
      </div>

      <div class="settings-row">
        <div>
          <label class="settings-row-title">大纲默认展开</label>
          <p class="settings-row-desc">启动时自动展开侧边栏大纲</p>
        </div>
        <SettingsSwitch v-model="outlineExpanded" label="切换大纲默认展开" />
      </div>

      <div class="settings-row settings-row--column">
        <div>
          <label class="settings-row-title">Tab 宽度</label>
          <p class="settings-row-desc">控制缩进与代码块、列表的默认对齐宽度。</p>
        </div>
        <SettingsTabWidthSelector v-model="tabWidth" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.editor-settings-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section-card {
  padding: 18px;
  border: 1px solid var(--border-color);
  border-radius: 22px;
  background: var(--bg-color);
  box-shadow: var(--shadow-sm);
}

.settings-section-card--hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  background:
    radial-gradient(
      circle at top right,
      color-mix(in srgb, var(--primary-light) 85%, transparent 15%),
      transparent 45%
    ),
    var(--bg-color);
}

.settings-section-title {
  color: var(--text-color);
  font-size: 15px;
  font-weight: 700;
}

.settings-section-desc {
  margin: 6px 0 0;
  color: var(--muted-color);
  font-size: 13px;
  line-height: 1.7;
}

.settings-hero-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.settings-hero-chip {
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
}

.settings-row + .settings-row {
  border-top: 1px solid var(--border-light);
}

.settings-row--column {
  align-items: flex-start;
  flex-direction: column;
}

.settings-row-title {
  display: block;
  color: var(--text-color);
  font-size: 14px;
  font-weight: 600;
}

.settings-row-desc {
  margin: 4px 0 0;
  color: var(--muted-color);
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 960px) {
  .settings-section-card--hero,
  .settings-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-hero-metrics {
    justify-content: flex-start;
  }
}
</style>
