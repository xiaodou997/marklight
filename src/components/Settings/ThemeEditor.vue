<script setup lang="ts">
import { watch } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { ThemeColors, ThemeId } from '../../themes/types';
import { exportTheme, generateThemeId, importTheme } from '../../themes/manager';
import ThemeColorGroups from './ThemeColorGroups.vue';
import ThemeEditorHeader from './ThemeEditorHeader.vue';
import ThemeEditorPreview from './ThemeEditorPreview.vue';
import type { ThemeColorGroup } from './theme-editor-types';
import { useThemeEditor } from './useThemeEditor';

const props = defineProps<{
  themeId?: ThemeId;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const settingsStore = useSettingsStore();
const {
  editTheme,
  editorIntro,
  isAdvancedPanelOpen,
  isEditing,
  saveButtonLabel,
  themeName,
  cancelEdit,
  replaceEditTheme,
  saveTheme,
  startAdvancedEdit,
  startCopyCurrentTheme,
  startEdit,
  updateColor,
} = useThemeEditor(settingsStore);

const colorGroups: ThemeColorGroup[] = [
  {
    name: '主色调',
    keys: ['primaryColor', 'primaryHover', 'primaryLight'] as (keyof ThemeColors)[],
  },
  {
    name: '背景',
    keys: ['bgColor', 'bgSecondary', 'sidebarBg', 'sidebarHover'] as (keyof ThemeColors)[],
  },
  {
    name: '文字',
    keys: ['textColor', 'textSecondary', 'mutedColor'] as (keyof ThemeColors)[],
  },
  {
    name: '边框与交互',
    keys: ['borderColor', 'borderLight', 'hoverBg', 'activeBg', 'selectedBg'] as (keyof ThemeColors)[],
  },
  {
    name: '代码与弹层',
    keys: ['codeBg', 'codeBorder', 'popoverBg', 'popoverBorder', 'modalBg', 'modalBorder'] as (keyof ThemeColors)[],
  },
  {
    name: '状态色',
    keys: ['successColor', 'warningColor', 'errorColor', 'infoColor'] as (keyof ThemeColors)[],
  },
  {
    name: 'Callout',
    keys: ['calloutNote', 'calloutTip', 'calloutWarning', 'calloutDanger', 'calloutSuccess', 'calloutQuote'] as (keyof ThemeColors)[],
  },
];

function exportCurrentTheme() {
  if (!editTheme.value) {
    return;
  }

  const json = exportTheme({
    ...editTheme.value,
    name: themeName.value.trim() || editTheme.value.name,
  });
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${themeName.value || editTheme.value.name}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importThemeFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const importedTheme = importTheme(text, editTheme.value?.appearance ?? 'light');
    replaceEditTheme({
      ...importedTheme,
      id: editTheme.value?.id ?? generateThemeId(),
      type: 'custom',
    });
    themeName.value = importedTheme.name;
  } catch (error) {
    console.error('导入主题失败:', error);
    alert('导入主题失败：无效的 JSON 文件');
  }

  input.value = '';
}

watch(
  () => props.themeId,
  (nextThemeId) => {
    if (nextThemeId && !isEditing.value) {
      startEdit(nextThemeId);
    }
  },
  { immediate: true },
);

defineExpose({
  startEdit,
  startCopyCurrentTheme,
  startAdvancedEdit,
});
</script>

<template>
  <div class="theme-editor">
    <div class="theme-editor-toolbar">
      <button class="theme-create-btn" @click="startCopyCurrentTheme">复制当前主题</button>
      <button class="theme-base-btn" @click="startAdvancedEdit">高级编辑</button>
    </div>

    <div v-if="isAdvancedPanelOpen && isEditing && editTheme" class="theme-editor-content">
      <ThemeEditorHeader
        :theme-name="themeName"
        :appearance="editTheme.appearance"
        :intro="editorIntro"
        @update-theme-name="themeName = $event"
        @export="exportCurrentTheme"
        @import="importThemeFile"
      />

      <ThemeEditorPreview :colors="editTheme.colors" />

      <ThemeColorGroups
        :colors="editTheme.colors"
        :groups="colorGroups"
        @update-color="updateColor"
      />

      <div class="theme-editor-footer">
        <button class="theme-cancel-btn" @click="cancelEdit">取消</button>
        <button class="theme-save-btn" @click="saveTheme">{{ saveButtonLabel }}</button>
      </div>
    </div>

    <div v-else class="theme-editor-start">
      <p class="theme-editor-hint">
        默认只需要在上方选择主题。想做自己的主题时，复制当前主题，或直接对当前主题进入高级编辑，再另存为新的自定义主题。
      </p>
    </div>
  </div>
</template>

<style scoped>
.theme-editor {
  padding: 12px;
}

.theme-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.theme-editor-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.theme-editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.theme-cancel-btn,
.theme-save-btn,
.theme-create-btn,
.theme-base-btn {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.theme-cancel-btn,
.theme-save-btn {
  padding: 10px 14px;
}

.theme-cancel-btn {
  background: var(--bg-color);
  color: var(--text-color);
}

.theme-cancel-btn:hover {
  background: var(--hover-bg);
}

.theme-save-btn,
.theme-create-btn {
  background: var(--btnPrimaryBg);
  border-color: var(--btnPrimaryBg);
  color: var(--btnPrimaryText);
}

.theme-save-btn:hover,
.theme-create-btn:hover {
  background: var(--btnPrimaryHover);
  border-color: var(--btnPrimaryHover);
}

.theme-editor-start {
  color: var(--muted-color);
}

.theme-editor-hint {
  margin: 0 0 12px;
  color: var(--muted-color);
  font-size: 13px;
  line-height: 1.6;
}

.theme-create-btn,
.theme-base-btn {
  padding: 8px 12px;
  font-size: 13px;
}

.theme-base-btn {
  background: var(--bg-color);
  color: var(--text-color);
}

.theme-base-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
}
</style>
