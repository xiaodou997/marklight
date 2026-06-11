<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import type { ShortcutDef } from '../../utils/shortcuts';

interface ShortcutGroup {
  name: string;
  items: ShortcutDef[];
}

defineProps<{
  conflictWarning: string | null;
  editingId: string | null;
  editingKey: string;
  formatShortcutDisplay: (shortcut: string) => string;
  isDefaultShortcut: (item: ShortcutDef) => boolean;
  isMac: boolean;
  setCaptureInputRef: (el: Element | ComponentPublicInstance | null) => void;
  shortcutGroups: ShortcutGroup[];
}>();

defineEmits<{
  resetAll: [];
  resetShortcut: [item: ShortcutDef];
  startEdit: [item: ShortcutDef];
  cancelEdit: [];
  captureKeydown: [event: KeyboardEvent, item: ShortcutDef];
}>();
</script>

<template>
  <div class="shortcut-settings-panel">
    <section class="settings-section-card settings-section-card--hero">
      <div class="shortcut-settings-panel__hint">
        {{ isMac ? 'Mac 使用 ⌘ 键' : 'Windows/Linux 使用 Ctrl 键' }} · 点击行可修改快捷键
      </div>
      <button
        class="shortcut-settings-panel__reset"
        style="color: var(--primary-color)"
        @click="$emit('resetAll')"
      >
        重置全部
      </button>
    </section>

    <section v-if="conflictWarning" class="settings-section-card settings-warning-card">
      <div class="settings-warning-text">⚠️ {{ conflictWarning }}</div>
    </section>

    <section v-for="group in shortcutGroups" :key="group.name" class="settings-section-card">
      <div class="settings-section-heading">
        <div class="settings-section-title">{{ group.name }}</div>
      </div>
      <div class="shortcut-settings-panel__list">
        <div
          v-for="item in group.items"
          :key="item.id"
          class="shortcut-settings-panel__item"
          :style="
            editingId === item.id
              ? 'background-color: rgba(99,102,241,0.08); outline: 2px solid var(--primary-color);'
              : 'background-color: var(--sidebar-bg);'
          "
          @click="$emit('startEdit', item)"
        >
          <span class="shortcut-settings-panel__description" style="color: var(--text-color)">
            {{ item.description }}
          </span>

          <div class="shortcut-settings-panel__controls">
            <button
              v-if="!isDefaultShortcut(item)"
              class="shortcut-settings-panel__item-reset"
              title="重置为默认"
              @click.stop="$emit('resetShortcut', item)"
            >
              ↺
            </button>

            <input
              v-if="editingId === item.id"
              :ref="setCaptureInputRef"
              type="text"
              readonly
              data-shortcut-capture="true"
              :value="formatShortcutDisplay(editingKey)"
              class="shortcut-input editing"
              placeholder="按下..."
              @keydown="$emit('captureKeydown', $event, item)"
              @blur="$emit('cancelEdit')"
            />

            <div v-else class="shortcut-input" :class="{ custom: !isDefaultShortcut(item) }">
              {{ formatShortcutDisplay(item.shortcut) }}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.shortcut-settings-panel {
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
  margin-bottom: 12px;
}

.settings-section-title {
  color: var(--text-color);
  font-size: 15px;
  font-weight: 700;
}

.settings-warning-card {
  padding: 14px 16px;
  border-color: #facc15;
  background: #fefce8;
}

.settings-warning-text {
  color: #a16207;
  font-size: 13px;
  font-weight: 600;
}

.shortcut-settings-panel__hint {
  color: var(--muted-color);
  font-size: 14px;
}

.shortcut-settings-panel__reset {
  font-size: 12px;
}

.shortcut-settings-panel__list {
  display: grid;
  gap: 6px;
}

.shortcut-settings-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.15s,
    outline-color 0.15s;
}

.shortcut-settings-panel__description {
  font-size: 14px;
}

.shortcut-settings-panel__controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.shortcut-settings-panel__item-reset {
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 12px;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.shortcut-settings-panel__item-reset:hover {
  background: #e5e7eb;
  color: #4b5563;
}

.shortcut-input {
  min-width: 100px;
  height: 30px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
  text-align: center;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.shortcut-input.custom {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.shortcut-input.editing {
  background: rgba(99, 102, 241, 0.08);
  border-color: var(--primary-color);
  color: var(--primary-color);
  outline: none;
}

@media (max-width: 960px) {
  .settings-section-card--hero {
    flex-direction: column;
  }
}
</style>
