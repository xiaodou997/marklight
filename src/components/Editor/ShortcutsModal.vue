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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        @click="onOverlayClick"
        @keydown="onKeyDown"
        tabindex="-1"
      >
        <div
          class="bg-white rounded-xl shadow-2xl w-[480px] max-h-[70vh] overflow-hidden flex flex-col"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">快捷键</h2>
            <button
              class="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              @click="close"
            >
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-6">
            <div class="text-sm text-gray-500 mb-4">
              {{ isMac ? 'Mac 使用 ⌘ 键' : 'Windows/Linux 使用 Ctrl 键' }}
            </div>
            
            <div v-for="group in shortcutGroups" :key="group.name" class="space-y-3 mb-6 last:mb-0">
              <h3 class="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
                {{ group.name }}
              </h3>
              <div class="grid gap-2">
                <div 
                  v-for="item in group.items" 
                  :key="item.id"
                  class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
                >
                  <span class="text-sm text-gray-700">{{ item.description }}</span>
                  <div class="shortcut-key">
                    {{ formatShortcutDisplay(item.key) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部 -->
          <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              class="w-full px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
              @click="close"
            >
              关闭
            </button>
          </div>
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
  transition: transform 0.2s ease, opacity 0.2s ease;
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

.shortcut-key {
  min-width: 100px;
  height: 30px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #374151;
  text-align: center;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.dark .shortcut-key {
  background: #1f2937;
  border-color: #4b5563;
  color: #d1d5db;
}
</style>
