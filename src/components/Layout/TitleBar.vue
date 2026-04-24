<template>
  <div
    class="titlebar select-none flex items-center justify-between h-9 border-b transition-colors"
    style="
      background-color: var(--bg-color);
      color: var(--text-color);
      border-color: var(--border-color);
    "
    data-tauri-drag-region
  >
    <div class="flex items-center h-full pl-2 space-x-1">
      <img src="/icon.png" class="w-4 h-4 mr-2" alt="Logo" />

      <div class="flex items-center h-full" data-tauri-no-drag>
        <div
          v-for="menu in menus"
          :key="menu.id"
          class="relative h-full flex items-center px-3 text-xs cursor-default transition-colors hover:bg-black/5"
          @mouseenter="onMenuHover(menu.id)"
          @mousedown.stop="toggleMenu(menu.id)"
        >
          {{ menu.label }}

          <div
            v-if="activeMenu === menu.id"
            class="absolute top-full left-0 w-48 py-1 rounded-b shadow-lg z-50"
            style="
              background-color: var(--bg-color);
              border: 1px solid var(--border-color);
              border-top: none;
            "
            @mousedown.stop
          >
            <template v-for="(item, idx) in menu.items" :key="idx">
              <div
                v-if="'type' in item && item.type === 'separator'"
                class="my-1 border-t"
                style="border-color: var(--border-color)"
              ></div>
              <div
                v-else-if="'id' in item"
                class="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-blue-600 hover:text-white cursor-default group"
                @click="handleMenuClick(item.id)"
              >
                <span>{{ item.label }}</span>
                <span class="text-[10px] opacity-50 group-hover:opacity-100 ml-4">{{
                  item.shortcut || ''
                }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center h-full" data-tauri-no-drag>
      <div @click="minimize" class="control-btn hover:bg-black/5">
        <svg class="w-3 h-3" viewBox="0 0 12 12">
          <rect fill="currentColor" width="10" height="1" x="1" y="6" />
        </svg>
      </div>
      <div @click="toggleMaximize" class="control-btn hover:bg-black/5">
        <svg class="w-3 h-3" viewBox="0 0 12 12">
          <rect
            fill="currentColor"
            width="9"
            height="9"
            x="1.5"
            y="1.5"
            stroke="currentColor"
            stroke-width="1"
            fill-opacity="0"
          />
        </svg>
      </div>
      <div @click="close" class="control-btn hover:bg-red-500 hover:text-white group">
        <svg class="w-3 h-3" viewBox="0 0 12 12">
          <path
            fill="currentColor"
            d="M10.5 1.5l-9 9m0-9l9 9"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import {
  WINDOW_TITLEBAR_MENUS,
  getCommand,
  getShortcut,
  type CommandDefinition,
} from '../../commands/registry';
import { formatShortcutDisplay } from '../../utils/shortcuts';
import { useSettingsStore } from '../../stores/settings';
import { emitMenuEvent, emitWindowCloseRequested } from '../../services/tauri/events';
import { minimizeCurrentWindow, toggleCurrentWindowMaximize } from '../../services/tauri/window';

const activeMenu = ref<string | null>(null);
const isMenuOpen = ref(false);
const settingsStore = useSettingsStore();

onMounted(() => {
  window.addEventListener('mousedown', closeAllMenus);
});

onUnmounted(() => {
  window.removeEventListener('mousedown', closeAllMenus);
});

const closeAllMenus = () => {
  activeMenu.value = null;
  isMenuOpen.value = false;
};

const toggleMenu = (id: string) => {
  if (activeMenu.value === id) {
    closeAllMenus();
  } else {
    activeMenu.value = id;
    isMenuOpen.value = true;
  }
};

const onMenuHover = (id: string) => {
  if (isMenuOpen.value) {
    activeMenu.value = id;
  }
};

const handleMenuClick = (id: string) => {
  void emitMenuEvent(id);
  closeAllMenus();
};

const minimize = () => void minimizeCurrentWindow();
const toggleMaximize = () => void toggleCurrentWindowMaximize();
const close = () => void emitWindowCloseRequested();

interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
}

interface MenuSeparator {
  type: 'separator';
}

type MenuItemOrSeparator = MenuItem | MenuSeparator;

interface Menu {
  id: string;
  label: string;
  items: MenuItemOrSeparator[];
}

function toMenuItem(command: CommandDefinition): MenuItem {
  return {
    id: command.id,
    label: command.title,
    shortcut: command.defaultShortcut
      ? formatShortcutDisplay(getShortcut(command, settingsStore.settings.customShortcuts) ?? '')
      : '',
  };
}

const menus = computed<Menu[]>(() =>
  WINDOW_TITLEBAR_MENUS.map((menu) => ({
    id: menu.id,
    label: menu.label,
    items: menu.items.map((item) => {
      if (item === 'separator') {
        return { type: 'separator' as const };
      }
      const command = getCommand(item);
      if (!command) {
        return { type: 'separator' as const };
      }
      return toMenuItem(command);
    }),
  })),
);
</script>

<style scoped>
@reference "../../assets/styles/main.css";

.control-btn {
  @apply w-11 h-full flex items-center justify-center transition-colors duration-150 text-zinc-600;
}
</style>
