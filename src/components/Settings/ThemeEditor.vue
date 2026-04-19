<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { Theme, ThemeColors, ThemeId } from '../../themes/types';
import { cloneTheme, generateThemeId, exportTheme, importTheme } from '../../themes/manager';
import { getPresetTheme } from '../../themes/manager';

const props = defineProps<{
  themeId?: ThemeId;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const settingsStore = useSettingsStore();

// 编辑状态
const isEditing = ref(false);
const editTheme = ref<Theme | null>(null);
const editMode = ref<'light' | 'dark'>('light');

// 主题名称
const themeName = ref('');

// 颜色编辑组
const colorGroups = [
  {
    name: '主色调',
    keys: ['primaryColor', 'primaryHover'] as (keyof ThemeColors)[],
  },
  {
    name: '背景',
    keys: ['bgColor', 'bgSecondary', 'sidebarBg'] as (keyof ThemeColors)[],
  },
  {
    name: '文字',
    keys: ['textColor', 'textSecondary', 'mutedColor'] as (keyof ThemeColors)[],
  },
  {
    name: '边框',
    keys: ['borderColor', 'borderLight'] as (keyof ThemeColors)[],
  },
  {
    name: '状态色',
    keys: ['successColor', 'warningColor', 'errorColor', 'infoColor'] as (keyof ThemeColors)[],
  },
  {
    name: 'Callout',
    keys: ['calloutNote', 'calloutTip', 'calloutWarning', 'calloutDanger', 'calloutSuccess'] as (keyof ThemeColors)[],
  },
];

// 开始编辑
function startEdit(themeId?: ThemeId) {
  if (themeId) {
    const theme = getPresetTheme(themeId) || settingsStore.settings.customThemes.find(t => t.id === themeId);
    if (theme) {
      editTheme.value = cloneTheme(theme);
      themeName.value = theme.name;
      editTheme.value.id = generateThemeId();
      editTheme.value.type = 'custom';
    }
  } else {
    // 创建新主题，基于默认主题
    const defaultTheme = getPresetTheme('default');
    if (defaultTheme) {
      editTheme.value = cloneTheme(defaultTheme);
      editTheme.value.id = generateThemeId();
      editTheme.value.type = 'custom';
      themeName.value = '新主题';
    }
  }
  isEditing.value = true;
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false;
  editTheme.value = null;
}

// 保存主题
function saveTheme() {
  if (!editTheme.value) return;

  editTheme.value.name = themeName.value;
  settingsStore.addCustomTheme(editTheme.value);
  cancelEdit();
}

// 更新颜色
function updateColor(key: keyof ThemeColors, value: string) {
  if (!editTheme.value) return;

  if (editMode.value === 'light') {
    editTheme.value.light[key] = value;
  } else {
    editTheme.value.dark[key] = value;
  }
}

// 导出主题
function exportCurrentTheme() {
  if (!editTheme.value) return;

  const json = exportTheme(editTheme.value);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${editTheme.value.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 导入主题
async function importThemeFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const theme = importTheme(text);
    editTheme.value = theme;
    themeName.value = theme.name;
  } catch (e) {
    console.error('导入主题失败:', e);
    alert('导入主题失败：无效的 JSON 文件');
  }

  input.value = '';
}

// 监听 props.themeId 变化
watch(() => props.themeId, (newId) => {
  if (newId && !isEditing.value) {
    startEdit(newId);
  }
}, { immediate: true });

// 暴露方法
defineExpose({
  startEdit,
});
</script>

<template>
  <div class="theme-editor">
    <!-- 编辑界面 -->
    <div v-if="isEditing && editTheme" class="theme-editor-content">
      <!-- 头部 -->
      <div class="theme-editor-header">
        <input
          v-model="themeName"
          type="text"
          class="theme-name-input"
          placeholder="主题名称"
        />
        <div class="theme-editor-actions">
          <button class="theme-action-btn" @click="exportCurrentTheme" title="导出">
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

      <!-- 模式切换 -->
      <div class="mode-switch">
        <button
          class="mode-btn"
          :class="{ 'mode-btn--active': editMode === 'light' }"
          @click="editMode = 'light'"
        >
          浅色
        </button>
        <button
          class="mode-btn"
          :class="{ 'mode-btn--active': editMode === 'dark' }"
          @click="editMode = 'dark'"
        >
          深色
        </button>
      </div>

      <!-- 颜色编辑 -->
      <div class="color-groups">
        <div v-for="group in colorGroups" :key="group.name" class="color-group">
          <div class="color-group-name">{{ group.name }}</div>
          <div class="color-items">
            <div v-for="key in group.keys" :key="key" class="color-item">
              <label class="color-label">{{ key.replace(/Color$/, '').replace(/^callout/, '') }}</label>
              <div class="color-input-wrapper">
                <input
                  type="color"
                  :value="editTheme[editMode][key]"
                  class="color-input"
                  @input="(e) => updateColor(key, (e.target as HTMLInputElement).value)"
                />
                <input
                  type="text"
                  :value="editTheme[editMode][key]"
                  class="color-text-input"
                  @input="(e) => updateColor(key, (e.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="theme-editor-footer">
        <button class="theme-cancel-btn" @click="cancelEdit">取消</button>
        <button class="theme-save-btn" @click="saveTheme">保存</button>
      </div>
    </div>

    <!-- 初始界面 -->
    <div v-else class="theme-editor-start">
      <p class="theme-editor-hint">选择一个主题作为基础开始编辑，或创建新主题</p>
      <div class="theme-editor-buttons">
        <button class="theme-create-btn" @click="startEdit()">
          创建新主题
        </button>
        <button
          v-for="theme in settingsStore.presetThemes"
          :key="theme.id"
          class="theme-base-btn"
          @click="startEdit(theme.id)"
        >
          基于 {{ theme.name }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-editor {
  padding: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.theme-editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.theme-name-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-md);
  color: var(--text-color);
  outline: none;
}

.theme-name-input:focus {
  border-color: var(--input-focus-border);
  box-shadow: var(--input-focus-shadow);
}

.theme-editor-actions {
  display: flex;
  gap: 4px;
}

.theme-action-btn {
  padding: 8px;
  border-radius: var(--radius-md);
  background-color: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s;
}

.theme-action-btn:hover {
  background-color: var(--hover-bg);
}

.theme-action-icon {
  width: 18px;
  height: 18px;
  color: var(--muted-color);
}

.hidden {
  display: none;
}

.mode-switch {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.mode-btn {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  background-color: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-color);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.mode-btn--active {
  background-color: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.color-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.color-group {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 12px;
}

.color-group-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-color);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.color-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.color-label {
  font-size: 11px;
  color: var(--muted-color);
}

.color-input-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.color-input {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px;
  cursor: pointer;
}

.color-text-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 12px;
  font-family: var(--font-mono);
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-color);
  outline: none;
}

.theme-editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.theme-cancel-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  background-color: var(--btn-secondary-bg);
  border: none;
  border-radius: var(--radius-md);
  color: var(--btn-secondary-text);
  cursor: pointer;
  transition: background-color 0.15s;
}

.theme-cancel-btn:hover {
  background-color: var(--btn-secondary-hover);
}

.theme-save-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  background-color: var(--btn-primary-bg);
  border: none;
  border-radius: var(--radius-md);
  color: var(--btn-primary-text);
  cursor: pointer;
  transition: background-color 0.15s;
}

.theme-save-btn:hover {
  background-color: var(--btn-primary-hover);
}

.theme-editor-start {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.theme-editor-hint {
  font-size: 13px;
  color: var(--muted-color);
}

.theme-editor-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-create-btn {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  background-color: var(--btn-primary-bg);
  border: none;
  border-radius: var(--radius-md);
  color: var(--btn-primary-text);
  cursor: pointer;
  transition: background-color 0.15s;
}

.theme-create-btn:hover {
  background-color: var(--btn-primary-hover);
}

.theme-base-btn {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  background-color: var(--btn-secondary-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--btn-secondary-text);
  cursor: pointer;
  transition: background-color 0.15s;
}

.theme-base-btn:hover {
  background-color: var(--btn-secondary-hover);
}
</style>