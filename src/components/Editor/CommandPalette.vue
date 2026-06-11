<template>
  <Teleport to="body">
    <Transition name="command-palette">
      <div
        v-if="visible"
        class="command-palette-overlay"
        @click.self="close"
      >
        <div class="command-palette">
          <!-- 搜索输入 -->
          <CommandPaletteSearchInput
            v-model="searchQuery"
            :visible="visible"
            :is-command-mode="isCommandMode"
            @select-next="selectNext"
            @select-prev="selectPrev"
            @execute-selected="executeSelected"
            @close="close"
          />

          <!-- 文件列表 -->
          <CommandPaletteFileList
            v-if="!isCommandMode"
            :files="filteredFiles"
            :selected-index="selectedIndex"
            :search-query="searchQuery"
            :has-workspace-files="allFiles.length > 0"
            :current-folder="currentFolder"
            @open="openFile"
            @select="selectedIndex = $event"
          />

          <!-- 命令列表 -->
          <CommandPaletteCommandList
            v-else
            :commands="filteredCommands"
            :selected-index="selectedIndex"
            @execute="executeCommand"
            @select="selectedIndex = $event"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { COMMANDS, getShortcut } from '../../commands/registry';
import { useSettingsStore } from '../../stores/settings';
import CommandPaletteCommandList from './CommandPaletteCommandList.vue';
import CommandPaletteFileList from './CommandPaletteFileList.vue';
import CommandPaletteSearchInput from './CommandPaletteSearchInput.vue';
import type { CommandPaletteCommand, CommandPaletteFile } from './command-palette-types';

const props = defineProps<{
  visible: boolean;
  files?: CommandPaletteFile[];
  currentFolder?: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'execute', command: CommandPaletteCommand): void;
  (e: 'open-file', path: string): void;
}>();

const settingsStore = useSettingsStore();
const searchQuery = ref('');
const selectedIndex = ref(0);

// 扁平化所有文件（递归）
const allFiles = computed<CommandPaletteFile[]>(() => {
  // 这里只使用传入的文件列表，不递归
  // 如果需要递归搜索，需要在 Rust 端实现
  return props.files || [];
});

// 判断是否为命令模式
const isCommandMode = computed(() => {
  return searchQuery.value.startsWith('>');
});

// 实际搜索查询（去掉前缀）
const actualQuery = computed(() => {
  if (isCommandMode.value) {
    return searchQuery.value.slice(1).trim().toLowerCase();
  }
  return searchQuery.value.trim().toLowerCase();
});

// 命令列表
const commands = computed<CommandPaletteCommand[]>(() =>
  COMMANDS
    .filter((command) => command.palette !== false)
    .map((command) => ({
      ...command,
      shortcut: getShortcut(command, settingsStore.settings.customShortcuts) ?? undefined,
    })),
);

// 过滤命令
const filteredCommands = computed(() => {
  const query = actualQuery.value;
  if (!query) return commands.value;
  
  return commands.value.filter(cmd => 
    cmd.title.toLowerCase().includes(query) ||
    cmd.id.toLowerCase().includes(query)
  );
});

// 过滤文件
const filteredFiles = computed(() => {
  const query = actualQuery.value;
  if (!query) return allFiles.value.slice(0, 20); // 限制显示数量
  
  return allFiles.value.filter(file => 
    file.name.toLowerCase().includes(query)
  ).slice(0, 20);
});

// 当前结果列表长度
const currentListLength = computed(() => {
  return isCommandMode.value ? filteredCommands.value.length : filteredFiles.value.length;
});

// 选择操作
const selectNext = () => {
  if (selectedIndex.value < currentListLength.value - 1) {
    selectedIndex.value++;
  }
};

const selectPrev = () => {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  }
};

const executeSelected = () => {
  if (isCommandMode.value) {
    if (filteredCommands.value[selectedIndex.value]) {
      executeCommand(filteredCommands.value[selectedIndex.value]);
    }
  } else {
    if (filteredFiles.value[selectedIndex.value]) {
      openFile(filteredFiles.value[selectedIndex.value]);
    }
  }
};

const executeCommand = (command: CommandPaletteCommand) => {
  emit('execute', command);
  close();
};

const openFile = (file: CommandPaletteFile) => {
  emit('open-file', file.path);
  close();
};

const close = () => {
  emit('close');
};

// 重置状态
watch(() => props.visible, (visible) => {
  if (visible) {
    searchQuery.value = '';
    selectedIndex.value = 0;
  }
});

// 搜索变化时重置选择
watch(searchQuery, () => {
  selectedIndex.value = 0;
});
</script>

<style scoped>
.command-palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  padding-top: 15vh;
  z-index: 1000;
}

.command-palette {
  width: 560px;
  max-height: 400px;
  background: var(--bg-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 过渡动画 */
.command-palette-enter-active,
.command-palette-leave-active {
  transition: opacity 0.15s ease;
}

.command-palette-enter-active .command-palette,
.command-palette-leave-active .command-palette {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.command-palette-enter-from,
.command-palette-leave-to {
  opacity: 0;
}

.command-palette-enter-from .command-palette,
.command-palette-leave-to .command-palette {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}
</style>
