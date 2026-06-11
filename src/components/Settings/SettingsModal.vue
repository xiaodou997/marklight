<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import { confirm } from '../../services/tauri/dialog';
import AppearanceSettingsPanel from './AppearanceSettingsPanel.vue';
import EditorSettingsPanel from './EditorSettingsPanel.vue';
import ExportSettingsPanel from './ExportSettingsPanel.vue';
import SaveSettingsPanel from './SaveSettingsPanel.vue';
import SettingsModalFooter from './SettingsModalFooter.vue';
import SettingsModalHeader from './SettingsModalHeader.vue';
import SettingsPageHeader from './SettingsPageHeader.vue';
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
                <AppearanceSettingsPanel
                  v-show="activeTab === 'appearance'"
                  v-model:font-size="settings.fontSize"
                  v-model:font-family="settings.fontFamily"
                  v-model:line-height="settings.lineHeight"
                  :current-theme-name="currentThemeName"
                />

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

</style>
