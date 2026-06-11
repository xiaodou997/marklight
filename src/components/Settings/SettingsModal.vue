<script setup lang="ts">
import { ref, computed } from 'vue';
import { confirm } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/settings';
import EditorSettingsPanel from './EditorSettingsPanel.vue';
import ExportSettingsPanel from './ExportSettingsPanel.vue';
import SaveSettingsPanel from './SaveSettingsPanel.vue';
import SettingsFontSelect from './SettingsFontSelect.vue';
import SettingsModalFooter from './SettingsModalFooter.vue';
import SettingsModalHeader from './SettingsModalHeader.vue';
import SettingsPageHeader from './SettingsPageHeader.vue';
import ThemeSelector from './ThemeSelector.vue';
import ThemeEditor from './ThemeEditor.vue';
import SettingsRangeField from './SettingsRangeField.vue';
import SettingsSidebarNav, { type SettingsTabKey } from './SettingsSidebarNav.vue';
import ShortcutSettingsPanel from './ShortcutSettingsPanel.vue';
import { useShortcutSettings } from './useShortcutSettings';

const settingsStore = useSettingsStore();
const settings = settingsStore.settings;

// 当前选中的设置分组
const activeTab = ref<SettingsTabKey>('appearance');
const {
  conflictWarning,
  editingId,
  editingKey,
  formatShortcutDisplay,
  isDefaultShortcut,
  isMac,
  resetAllShortcuts,
  resetShortcut,
  shortcutGroups,
  startEdit,
  setCaptureInputRef,
  cancelEdit,
  captureKeydown,
} = useShortcutSettings(settings);

const tabMeta = {
  appearance: {
    title: '外观与主题',
    description: '管理应用主题、字体与排版风格，让界面更贴近你的使用习惯。',
  },
  editor: {
    title: '编辑器偏好',
    description: '调整编辑器行为、显示细节和写作体验相关设置。',
  },
  shortcuts: {
    title: '快捷键',
    description: '查看并修改命令快捷键，建立更顺手的操作路径。',
  },
  save: {
    title: '保存策略',
    description: '控制自动保存与文件持久化行为。',
  },
  export: {
    title: '导出',
    description: '设置复制到微信等导出场景的排版风格。',
  },
} as const;

const activeTabMeta = computed(() => tabMeta[activeTab.value]);
const currentThemeName = computed(() => settingsStore.currentTheme?.name ?? '未选择主题');

// 关闭弹窗
function close() {
  settingsStore.closeModal();
  cancelEdit();
}

// 点击遮罩关闭
function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close();
  }
}

// 重置设置
async function handleReset() {
  const confirmed = await confirm('确定要恢复默认设置吗？', {
    title: '恢复默认',
    kind: 'warning',
    okLabel: '恢复',
    cancelLabel: '取消',
  });
  if (confirmed) {
    settingsStore.resetSettings();
  }
}

// 快捷键关闭
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close();
  }
}

</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="settingsStore.isModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        tabindex="-1"
        @click="onOverlayClick"
        @keydown="onKeyDown"
      >
        <div
          class="rounded-xl shadow-2xl w-[1040px] max-w-[94vw] max-h-[84vh] overflow-hidden flex flex-col"
          style="background-color: var(--bg-color); color: var(--text-color)"
          @click.stop
        >
          <!-- 头部 -->
          <SettingsModalHeader @close="close" />

          <!-- 主体 -->
          <div class="flex flex-1 overflow-hidden settings-shell">
            <!-- 侧边导航 -->
            <SettingsSidebarNav v-model="activeTab" />

            <!-- 设置内容 -->
            <div
              class="flex-1 overflow-y-auto settings-content-area"
              style="background-color: var(--bg-secondary)"
            >
              <div class="settings-content">
                <SettingsPageHeader
                  :title="activeTabMeta.title"
                  :description="activeTabMeta.description"
                  :badge="activeTab === 'appearance' ? `当前主题：${currentThemeName}` : undefined"
                />

                <!-- 外观设置 -->
                <div v-show="activeTab === 'appearance'" class="space-y-6">
                  <section class="settings-section-card settings-section-card--hero">
                    <div>
                      <div class="settings-section-title">当前主题</div>
                      <p class="settings-section-desc">
                        主题选择会立即生效。默认先从主题库里挑选风格，只有在需要个性化时再进入高级编辑。
                      </p>
                    </div>
                    <div class="settings-hero-metrics">
                      <div class="settings-hero-chip">应用主题：{{ currentThemeName }}</div>
                      <div class="settings-hero-chip">字体：{{ settings.fontFamily }}</div>
                      <div class="settings-hero-chip">字号：{{ settings.fontSize }}px</div>
                    </div>
                  </section>

                  <section class="settings-section-card">
                    <div class="settings-section-heading">
                      <div>
                        <div class="settings-section-title">主题库</div>
                        <p class="settings-section-desc">
                          所有主题默认直接展示，方便快速横向比较。
                        </p>
                      </div>
                    </div>
                    <ThemeSelector />
                  </section>

                  <section class="settings-section-card">
                    <div class="settings-section-heading">
                      <div>
                        <div class="settings-section-title">主题定制</div>
                        <p class="settings-section-desc">
                          复制当前主题后进入高级编辑，调整颜色并另存为新的自定义主题。
                        </p>
                      </div>
                    </div>
                    <ThemeEditor />
                  </section>

                  <section class="settings-section-card">
                    <div class="settings-section-heading">
                      <div>
                        <div class="settings-section-title">排版与阅读</div>
                        <p class="settings-section-desc">
                          统一控制字体、字号和行高，保持写作与阅读体验协调。
                        </p>
                      </div>
                    </div>
                    <div class="settings-form-grid">
                      <SettingsRangeField
                        v-model="settings.fontSize"
                        class="settings-form-item"
                        label="字体大小"
                        :min="12"
                        :max="24"
                        :step="1"
                        value-suffix="px"
                        min-label="12px"
                        max-label="24px"
                      />

                      <SettingsFontSelect
                        v-model="settings.fontFamily"
                        class="settings-form-item"
                      />

                      <SettingsRangeField
                        v-model="settings.lineHeight"
                        class="settings-form-item"
                        label="行高"
                        :min="1.2"
                        :max="2.4"
                        :step="0.1"
                      />
                    </div>
                  </section>
                </div>

                <!-- 编辑器设置 -->
                <EditorSettingsPanel
                  v-show="activeTab === 'editor'"
                  v-model:show-line-numbers="settings.showLineNumbers"
                  v-model:spell-check="settings.spellCheck"
                  v-model:outline-expanded="settings.outlineExpanded"
                  v-model:tab-width="settings.tabWidth"
                />

                <!-- 快捷键设置 -->
                <ShortcutSettingsPanel
                  v-show="activeTab === 'shortcuts'"
                  :conflict-warning="conflictWarning"
                  :editing-id="editingId"
                  :editing-key="editingKey"
                  :format-shortcut-display="formatShortcutDisplay"
                  :is-default-shortcut="isDefaultShortcut"
                  :is-mac="isMac"
                  :set-capture-input-ref="setCaptureInputRef"
                  :shortcut-groups="shortcutGroups"
                  @reset-all="resetAllShortcuts"
                  @reset-shortcut="resetShortcut"
                  @start-edit="startEdit"
                  @cancel-edit="cancelEdit"
                  @capture-keydown="captureKeydown"
                />

                <!-- 保存设置 -->
                <SaveSettingsPanel
                  v-show="activeTab === 'save'"
                  v-model:auto-save="settings.autoSave"
                  v-model:auto-save-interval="settings.autoSaveInterval"
                />

                <!-- 导出设置 -->
                <ExportSettingsPanel
                  v-show="activeTab === 'export'"
                  v-model:wechat-theme="settings.wechatTheme"
                />
              </div>
            </div>
          </div>

          <!-- 底部 -->
          <SettingsModalFooter @reset="handleReset" @close="close" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95);
  opacity: 0;
}

.settings-shell {
  min-height: 0;
}

.settings-content-area {
  min-width: 0;
}

.settings-content {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 28px 28px 32px;
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

.settings-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 960px) {
  .settings-section-card--hero {
    flex-direction: column;
  }

  .settings-hero-metrics {
    justify-content: flex-start;
  }

  .settings-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
