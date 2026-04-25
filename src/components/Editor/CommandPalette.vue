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
          <div class="command-input-wrapper">
            <svg class="command-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref="inputRef"
              v-model="searchQuery"
              type="text"
              class="command-input"
              :placeholder="isCommandMode ? '搜索命令...' : '搜索文件... (输入 > 搜索命令)'"
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
              @keydown.enter.prevent="executeSelected"
              @keydown.esc="close"
            />
          </div>

          <!-- 文件列表 -->
          <div v-if="!isCommandMode" class="command-list">
            <div v-if="filteredFiles.length > 0" class="command-list-header">文件</div>
            <div
              v-for="(file, index) in filteredFiles"
              :key="file.path"
              class="command-item"
              :class="{ 'command-item-selected': index === selectedIndex }"
              @click="openFile(file)"
              @mouseenter="selectedIndex = index"
            >
              <div class="command-item-icon">
                <template v-if="file.is_dir">📁</template>
                <template v-else-if="file.is_md">📝</template>
                <template v-else>📄</template>
              </div>
              <div class="command-item-content">
                <div class="command-item-title">{{ file.name }}</div>
                <div class="command-item-path">{{ getRelativePath(file.path) }}</div>
              </div>
            </div>
            <div v-if="filteredFiles.length === 0 && searchQuery" class="command-empty">
              没有找到匹配的文件
            </div>
            <div v-if="filteredFiles.length === 0 && !searchQuery && allFiles.length === 0" class="command-empty">
              请先打开文件夹
            </div>
            <div v-if="filteredFiles.length === 0 && !searchQuery && allFiles.length > 0" class="command-empty">
              输入关键词搜索文件
            </div>
          </div>

          <!-- 命令列表 -->
          <div v-else class="command-list">
            <div
              v-for="(command, index) in filteredCommands"
              :key="command.id"
              class="command-item"
              :class="{ 'command-item-selected': index === selectedIndex }"
              @click="executeCommand(command)"
              @mouseenter="selectedIndex = index"
            >
              <div class="command-item-icon">{{ command.icon }}</div>
              <div class="command-item-content">
                <div class="command-item-title">{{ command.title }}</div>
                <div v-if="command.shortcut" class="command-item-shortcut">
                  {{ formatShortcutDisplay(command.shortcut) }}
                </div>
              </div>
            </div>
            <div v-if="filteredCommands.length === 0" class="command-empty">
              没有找到匹配的命令
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  COMMANDS,
  getShortcut,
  type CommandDefinition,
} from '../../commands/registry';
import { formatShortcutDisplay } from '../../utils/shortcuts';
import { useSettingsStore } from '../../stores/settings';

interface Command extends CommandDefinition {
  shortcut?: string;
}

interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_md: boolean;
}

const props = defineProps<{
  visible: boolean;
  files?: FileInfo[];
  currentFolder?: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'execute', command: Command): void;
  (e: 'open-file', path: string): void;
}>();

const settingsStore = useSettingsStore();
const inputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const selectedIndex = ref(0);

// 扁平化所有文件（递归）
const allFiles = computed<FileInfo[]>(() => {
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
const commands = computed<Command[]>(() =>
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

// 获取相对路径
function getRelativePath(path: string) {
  if (!props.currentFolder) return path;
  return path.replace(props.currentFolder, '~');
}

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

const executeCommand = (command: Command) => {
  emit('execute', command);
  close();
};

const openFile = (file: FileInfo) => {
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
    nextTick(() => {
      inputRef.value?.focus();
    });
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

.command-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.command-input-icon {
  width: 20px;
  height: 20px;
  color: #9ca3af;
  margin-right: 12px;
  flex-shrink: 0;
}

.command-input {
  flex: 1;
  font-size: 16px;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
}

.command-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.command-list-header {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 12px;
  margin-bottom: 4px;
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

.command-item-path {
  font-size: 12px;
  color: #9ca3af;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
