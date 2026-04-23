<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { Theme, ThemeAppearance, ThemeColors, ThemeId } from '../../themes/types';
import { cloneTheme, exportTheme, generateThemeId, getPresetTheme, importTheme } from '../../themes/manager';

const props = defineProps<{
  themeId?: ThemeId;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const settingsStore = useSettingsStore();

const isEditing = ref(false);
const editTheme = ref<Theme | null>(null);
const themeName = ref('');
const editingThemeId = ref<ThemeId | null>(null);
const isAdvancedPanelOpen = ref(false);

const currentTheme = computed(() => settingsStore.currentTheme);
const saveButtonLabel = computed(() => (editingThemeId.value ? '保存修改' : '另存为新主题'));
const editorIntro = computed(() => {
  if (!editTheme.value) {
    return '';
  }

  return editingThemeId.value
    ? '正在编辑当前自定义主题。保存后会直接覆盖原主题。'
    : '当前编辑基于现有主题创建副本，保存后会生成一个新的自定义主题。';
});

const colorGroups = [
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

function getAppearanceLabel(appearance: ThemeAppearance) {
  return appearance === 'dark' ? '深色主题' : '浅色主题';
}

function createThemeDraft(baseTheme: Theme, preserveId: boolean) {
  const nextTheme = cloneTheme(baseTheme);
  nextTheme.type = 'custom';

  if (!preserveId) {
    nextTheme.id = generateThemeId();
  }

  return nextTheme;
}

function beginEditing(theme: Theme, options: { preserveId?: boolean; nextName?: string } = {}) {
  const preserveId = options.preserveId ?? false;
  editTheme.value = createThemeDraft(theme, preserveId);
  themeName.value = options.nextName ?? theme.name;
  editingThemeId.value = preserveId ? theme.id : null;
  isEditing.value = true;
  isAdvancedPanelOpen.value = true;
}

function startEdit(themeId?: ThemeId) {
  const theme = themeId
    ? getPresetTheme(themeId) || settingsStore.settings.customThemes.find((item) => item.id === themeId)
    : null;

  if (!theme) {
    return;
  }

  beginEditing(theme, {
    preserveId: theme.type === 'custom',
    nextName: theme.name,
  });
}

function startCopyCurrentTheme() {
  if (!currentTheme.value) {
    return;
  }

  beginEditing(currentTheme.value, {
    nextName: `${currentTheme.value.name} 副本`,
  });
}

function startAdvancedEdit() {
  if (!currentTheme.value) {
    return;
  }

  beginEditing(currentTheme.value, {
    preserveId: currentTheme.value.type === 'custom',
    nextName: currentTheme.value.name,
  });
}

function cancelEdit() {
  isEditing.value = false;
  editTheme.value = null;
  themeName.value = '';
  editingThemeId.value = null;
  isAdvancedPanelOpen.value = false;
}

function saveTheme() {
  if (!editTheme.value) {
    return;
  }

  const nextTheme: Theme = {
    ...editTheme.value,
    name: themeName.value.trim() || editTheme.value.name,
    type: 'custom',
  };

  if (editingThemeId.value) {
    settingsStore.updateCustomTheme(editingThemeId.value, nextTheme);
    settingsStore.setColorTheme(editingThemeId.value);
  } else {
    settingsStore.addCustomTheme(nextTheme);
    settingsStore.setColorTheme(nextTheme.id);
  }

  cancelEdit();
}

function updateColor(key: keyof ThemeColors, value: string) {
  if (!editTheme.value) {
    return;
  }

  editTheme.value.colors[key] = value;
}

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
    editTheme.value = {
      ...importedTheme,
      id: editTheme.value?.id ?? generateThemeId(),
      type: 'custom',
    };
    themeName.value = importedTheme.name;
  } catch (error) {
    console.error('导入主题失败:', error);
    alert('导入主题失败：无效的 JSON 文件');
  }

  input.value = '';
}

function formatColorLabel(key: keyof ThemeColors) {
  return key
    .replace(/Color|Bg|Border|Shadow|Hover|Light|Secondary/g, (match) => ` ${match}`)
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
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
      <div class="theme-editor-header">
        <div class="theme-editor-heading">
          <input
            v-model="themeName"
            type="text"
            class="theme-name-input"
            placeholder="主题名称"
          />
          <span class="theme-appearance-badge">{{ getAppearanceLabel(editTheme.appearance) }}</span>
          <p class="theme-editor-intro">{{ editorIntro }}</p>
        </div>
        <div class="theme-editor-actions">
          <button class="theme-action-btn" title="导出" @click="exportCurrentTheme">
            <svg class="theme-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <label class="theme-action-btn" title="导入">
            <svg class="theme-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <input type="file" accept=".json" class="hidden" @change="importThemeFile" />
          </label>
        </div>
      </div>

      <div class="theme-preview-card">
        <div
          class="theme-preview-surface"
          :style="{
            backgroundColor: editTheme.colors.bgColor,
            borderColor: editTheme.colors.borderColor,
            color: editTheme.colors.textColor,
          }"
        >
          <div
            class="theme-preview-chip"
            :style="{ backgroundColor: editTheme.colors.primaryColor }"
          />
          <div
            class="theme-preview-text"
            :style="{ backgroundColor: editTheme.colors.textColor }"
          />
          <div
            class="theme-preview-text theme-preview-text--muted"
            :style="{ backgroundColor: editTheme.colors.textSecondary }"
          />
        </div>
      </div>

      <div class="color-groups">
        <div v-for="group in colorGroups" :key="group.name" class="color-group">
          <div class="color-group-name">{{ group.name }}</div>
          <div class="color-items">
            <div v-for="key in group.keys" :key="key" class="color-item">
              <label class="color-label">{{ formatColorLabel(key) }}</label>
              <div class="color-input-wrapper">
                <input
                  type="color"
                  :value="editTheme.colors[key]"
                  class="color-input"
                  @input="(event) => updateColor(key, (event.target as HTMLInputElement).value)"
                />
                <input
                  type="text"
                  :value="editTheme.colors[key]"
                  class="color-text-input"
                  @input="(event) => updateColor(key, (event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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

.theme-editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.theme-editor-heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.theme-name-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--input-bg);
  color: var(--text-color);
  font-size: 14px;
  outline: none;
}

.theme-name-input:focus {
  border-color: var(--input-focus-border);
  box-shadow: var(--input-focus-shadow);
}

.theme-appearance-badge {
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
}

.theme-editor-intro {
  margin: 0;
  color: var(--muted-color);
  font-size: 12px;
  line-height: 1.6;
}

.theme-editor-actions {
  display: flex;
  gap: 8px;
}

.theme-action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-color);
  color: var(--text-color);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.theme-action-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
}

.theme-action-icon {
  width: 18px;
  height: 18px;
}

.theme-preview-card {
  padding: 14px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--sidebar-bg);
}

.theme-preview-surface {
  min-height: 88px;
  padding: 16px;
  border: 1px solid;
  border-radius: var(--radius-lg);
}

.theme-preview-chip {
  width: 56px;
  height: 12px;
  border-radius: 999px;
}

.theme-preview-text {
  width: 78%;
  height: 10px;
  margin-top: 18px;
  border-radius: 999px;
  opacity: 0.9;
}

.theme-preview-text--muted {
  width: 52%;
  margin-top: 10px;
  opacity: 0.55;
}

.color-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.color-group {
  padding: 14px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--bg-color);
}

.color-group-name {
  margin-bottom: 12px;
  color: var(--text-color);
  font-size: 13px;
  font-weight: 600;
}

.color-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.color-label {
  color: var(--muted-color);
  font-size: 12px;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
}

.color-input {
  width: 40px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: none;
}

.color-text-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--input-bg);
  color: var(--text-color);
  font-family: 'SFMono-Regular', 'JetBrains Mono', monospace;
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
