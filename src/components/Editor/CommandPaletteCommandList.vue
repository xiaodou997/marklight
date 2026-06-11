<script setup lang="ts">
import { formatShortcutDisplay } from '../../utils/shortcuts';
import type { CommandPaletteCommand } from './command-palette-types';

defineProps<{
  commands: CommandPaletteCommand[];
  selectedIndex: number;
}>();

const emit = defineEmits<{
  (e: 'execute', command: CommandPaletteCommand): void;
  (e: 'select', index: number): void;
}>();
</script>

<template>
  <div class="command-list">
    <div
      v-for="(command, index) in commands"
      :key="command.id"
      class="command-item"
      :class="{ 'command-item-selected': index === selectedIndex }"
      @click="emit('execute', command)"
      @mouseenter="emit('select', index)"
    >
      <div class="command-item-icon">{{ command.icon }}</div>
      <div class="command-item-content">
        <div class="command-item-title">{{ command.title }}</div>
        <div v-if="command.shortcut" class="command-item-shortcut">
          {{ formatShortcutDisplay(command.shortcut) }}
        </div>
      </div>
    </div>
    <div v-if="commands.length === 0" class="command-empty">没有找到匹配的命令</div>
  </div>
</template>

<style scoped>
.command-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.command-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.1s;
}

.command-item:hover,
.command-item-selected {
  background: rgba(0, 0, 0, 0.05);
}

.dark .command-item:hover,
.dark .command-item-selected {
  background: rgba(255, 255, 255, 0.1);
}

.command-item-icon {
  font-size: 18px;
  width: 28px;
  text-align: center;
  margin-right: 12px;
}

.command-item-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.command-item-title {
  font-size: 14px;
  color: inherit;
}

.command-item-shortcut {
  font-size: 12px;
  color: #9ca3af;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.command-empty {
  padding: 24px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}
</style>
