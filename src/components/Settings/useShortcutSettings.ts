import { computed, nextTick, shallowRef, type ComponentPublicInstance } from 'vue';

import type { Settings } from '../../stores/settings';
import { confirm } from '../../services/tauri/dialog';
import { isMac } from '../../utils/platform';
import {
  eventToKeyString,
  formatShortcutDisplay,
  getCommand,
  getShortcutCommands,
  getShortcutGroups,
  type ShortcutDef,
} from '../../utils/shortcuts';

export function useShortcutSettings(settings: Settings) {
  const editingId = shallowRef<string | null>(null);
  const editingKey = shallowRef('');
  const conflictWarning = shallowRef<string | null>(null);
  const captureInputRef = shallowRef<HTMLInputElement | null>(null);

  const shortcutGroups = computed(() => {
    return getShortcutGroups(settings.customShortcuts);
  });

  function setCaptureInputRef(el: Element | ComponentPublicInstance | null) {
    captureInputRef.value = el instanceof HTMLInputElement ? el : null;
  }

  function startEdit(item: ShortcutDef) {
    editingId.value = item.id;
    editingKey.value = settings.customShortcuts[item.id] ?? item.defaultShortcut ?? '';
    conflictWarning.value = null;

    nextTick(() => {
      captureInputRef.value?.focus();
    });
  }

  function cancelEdit() {
    editingId.value = null;
    editingKey.value = '';
    conflictWarning.value = null;
  }

  function captureKeydown(event: KeyboardEvent, item: ShortcutDef) {
    if (['Control', 'Meta', 'Shift', 'Alt'].includes(event.key)) {
      return;
    }

    if (event.key === 'Escape') {
      cancelEdit();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const keyStr = eventToKeyString(event);

    if (keyStr.endsWith('Mod-') || keyStr.endsWith('Shift-') || keyStr.endsWith('Alt-')) {
      return;
    }

    const nextCustom = { ...settings.customShortcuts, [item.id]: keyStr };
    const conflictingItems = getShortcutCommands(nextCustom).filter(
      (command) => command.shortcut === keyStr && command.id !== item.id,
    );

    editingKey.value = keyStr;

    if (conflictingItems.length > 0) {
      conflictWarning.value = `快捷键冲突: ${conflictingItems.map((command) => command.description).join('、')}`;
      return;
    }

    conflictWarning.value = null;
    settings.customShortcuts[item.id] = keyStr;
  }

  function resetShortcut(item: ShortcutDef) {
    const defaultDef = getCommand(item.id);
    if (defaultDef?.defaultShortcut && settings.customShortcuts[item.id]) {
      delete settings.customShortcuts[item.id];
    }
    conflictWarning.value = null;
  }

  async function resetAllShortcuts() {
    const confirmed = await confirm('确定要重置所有快捷键为默认值吗？', {
      title: '重置快捷键',
      kind: 'warning',
      okLabel: '重置',
      cancelLabel: '取消',
    });
    if (confirmed) {
      settings.customShortcuts = {};
      conflictWarning.value = null;
    }
  }

  function isDefaultShortcut(item: ShortcutDef): boolean {
    const defaultDef = getCommand(item.id);
    return (
      !settings.customShortcuts[item.id] ||
      settings.customShortcuts[item.id] === defaultDef?.defaultShortcut
    );
  }

  return {
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
  };
}
