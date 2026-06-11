<script setup lang="ts">
import WechatThemeSelector from './WechatThemeSelector.vue';

const wechatTheme = defineModel<string>('wechatTheme', { required: true });
</script>

<template>
  <div class="export-settings-panel">
    <section class="settings-section-card settings-section-card--hero">
      <div>
        <div class="settings-section-title">导出主题</div>
        <p class="settings-section-desc">控制复制到微信等场景时的排版风格和主色表现。</p>
      </div>
    </section>

    <section class="settings-section-card">
      <div class="settings-section-heading">
        <div>
          <div class="settings-section-title">主题选择</div>
          <p class="settings-section-desc">当前为复制到微信的富文本导出提供单独的排版主题。</p>
        </div>
      </div>
      <WechatThemeSelector v-model="wechatTheme" />
    </section>
  </div>
</template>

<style scoped>
.export-settings-panel {
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

.settings-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
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
</style>
