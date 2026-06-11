import { computed, ref } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { Theme, ThemeColors, ThemeId } from '../../themes/types';
import { cloneTheme, generateThemeId, getPresetTheme } from '../../themes/manager';

type SettingsStore = ReturnType<typeof useSettingsStore>;

export function useThemeEditor(settingsStore: SettingsStore) {
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

  function replaceEditTheme(nextTheme: Theme) {
    editTheme.value = nextTheme;
  }

  return {
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
  };
}
