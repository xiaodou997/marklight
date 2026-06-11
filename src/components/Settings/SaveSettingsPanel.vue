<script setup lang="ts">
import SettingsRangeField from './SettingsRangeField.vue';
import SettingsSwitch from './SettingsSwitch.vue';

const autoSave = defineModel<boolean>('autoSave', { required: true });
const autoSaveInterval = defineModel<number>('autoSaveInterval', { required: true });
</script>

<template>
  <div class="save-settings-panel">
    <section class="settings-section-card settings-section-card--hero">
      <div>
        <div class="settings-section-title">文档保存</div>
        <p class="settings-section-desc">
          自动保存适合持续写作，关闭后会完全改回手动保存模式。
        </p>
      </div>
      <div class="settings-hero-metrics">
        <div class="settings-hero-chip">自动保存：{{ autoSave ? '开启' : '关闭' }}</div>
        <div v-if="autoSave" class="settings-hero-chip">间隔：{{ autoSaveInterval }} 秒</div>
      </div>
    </section>

    <section class="settings-section-card">
      <div class="settings-row">
        <div>
          <label class="settings-row-title">自动保存</label>
          <p class="settings-row-desc">编辑时自动保存文件</p>
        </div>
        <SettingsSwitch v-model="autoSave" label="切换自动保存" />
      </div>

      <div v-if="autoSave" class="settings-row settings-row--column">
        <div>
          <label class="settings-row-title">保存间隔: {{ autoSaveInterval }} 秒</label>
          <p class="settings-row-desc">在不打断写作的前提下平衡安全性与性能。</p>
        </div>
        <SettingsRangeField
          v-model="autoSaveInterval"
          class="w-full"
          label="保存间隔"
          :min="10"
          :max="120"
          :step="10"
          value-suffix=" 秒"
          min-label="10秒"
          max-label="120秒"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.save-settings-panel {
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
