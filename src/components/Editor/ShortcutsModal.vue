<script setup lang="ts">
import { computed } from 'vue';
import { isMac } from '../../utils/platform';
import { getShortcutGroups, formatShortcutDisplay } from '../../utils/shortcuts';
import { useSettingsStore } from '../../stores/settings';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const settingsStore = useSettingsStore();

// 获取快捷键列表并按分组
const shortcutGroups = computed(() => {
  return getShortcutGroups(settingsStore.settings.customShortcuts);
});

function close() {
  emit('close');
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close();
  }
}

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
        v-if="visible"
        class="modal-overlay"
        @click="onOverlayClick"
        @keydown="onKeyDown"
        tabindex="-1"
      >
        <div class="modal-container" @click.stop>
          <!-- 头部 -->
          <div class="modal-header">
            <h2 class="modal-title">快捷键</h2>
            <button class="modal-close-btn" @click="close">
              <svg class="modal-close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 主体 -->
          <div class="modal-body">
            <div class="modal-hint">
              {{ isMac ? 'Mac 使用 ⌘ 键' : 'Windows/Linux 使用 Ctrl 键' }}
            </div>

            <div v-for="group in shortcutGroups" :key="group.name" class="shortcut-group">
              <h3 class="shortcut-group-title">
                {{ group.name }}
              </h3>
              <div class="shortcut-items">
                <div
                  v-for="item in group.items"
                  :key="item.id"
                  class="shortcut-item"
                >
                  <span class="shortcut-desc">{{ item.description }}</span>
                  <div class="shortcut-key">
                    {{ formatShortcutDisplay(item.key) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部 -->
          <div class="modal-footer">
            <button class="modal-btn-primary" @click="close">
              关闭
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--modal-overlay);
  backdrop-filter: blur(4px);
}

.modal-container {
  background-color: var(--modal-bg);
  border: 1px solid var(--modal-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--modal-shadow);
  width: 480px;
  max-height: 70vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.modal-close-btn {
  padding: 4px;
  border-radius: var(--radius-md);
  background-color: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s;
}

.modal-close-btn:hover {
  background-color: var(--hover-bg);
}

.modal-close-icon {
  width: 20px;
  height: 20px;
  color: var(--muted-color);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.modal-hint {
  font-size: 14px;
  color: var(--muted-color);
  margin-bottom: 16px;
}

.shortcut-group {
  margin-bottom: 24px;
}

.shortcut-group:last-child {
  margin-bottom: 0;
}

.shortcut-group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 4px;
}

.shortcut-items {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background-color: var(--bg-secondary);
}

.shortcut-desc {
  font-size: 14px;
  color: var(--text-secondary);
}

.shortcut-key {
  min-width: 100px;
  height: 30px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-family: var(--font-mono);
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-md);
  color: var(--text-color);
  text-align: center;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.modal-btn-primary {
  width: 100%;
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 500;
  background-color: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color 0.15s;
}

.modal-btn-primary:hover {
  background-color: var(--btn-primary-hover);
}

/* 动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active > .modal-container,
.modal-leave-active > .modal-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > .modal-container,
.modal-leave-to > .modal-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>