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
              placeholder="搜索命令..."
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
              @keydown.enter.prevent="executeSelected"
              @keydown.esc="close"
            />
          </div>

          <!-- 命令列表 -->
          <div class="command-list">
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
                  {{ command.shortcut }}
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

interface Command {
  id: string;
  title: string;
  icon: string;
  shortcut?: string;
  action: () => void;
}

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'execute', command: Command): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const selectedIndex = ref(0);

// 命令列表
const commands = computed<Command[]>(() => [
  // 文件操作
  { id: 'file.new', title: '新建文件', icon: '📄', shortcut: '⌘N', action: () => emit('execute', { id: 'file.new' } as Command) },
  { id: 'file.open', title: '打开文件', icon: '📂', shortcut: '⌘O', action: () => emit('execute', { id: 'file.open' } as Command) },
  { id: 'file.save', title: '保存文件', icon: '💾', shortcut: '⌘S', action: () => emit('execute', { id: 'file.save' } as Command) },
  { id: 'file.saveAs', title: '另存为...', icon: '💾', shortcut: '⌘⇧S', action: () => emit('execute', { id: 'file.saveAs' } as Command) },
  { id: 'file.newWindow', title: '新建窗口', icon: '🪟', shortcut: '⌘⇧N', action: () => emit('execute', { id: 'file.newWindow' } as Command) },
  
  // 编辑操作
  { id: 'edit.find', title: '查找', icon: '🔍', shortcut: '⌘F', action: () => emit('execute', { id: 'edit.find' } as Command) },
  { id: 'edit.replace', title: '查找和替换', icon: '🔄', shortcut: '⌘H', action: () => emit('execute', { id: 'edit.replace' } as Command) },
  
  // 视图操作
  { id: 'view.focusMode', title: '切换焦点模式', icon: '🎯', shortcut: '⌘⇧F', action: () => emit('execute', { id: 'view.focusMode' } as Command) },
  { id: 'view.toggleSidebar', title: '切换侧边栏', icon: '📋', shortcut: '⌘\\', action: () => emit('execute', { id: 'view.toggleSidebar' } as Command) },
  { id: 'view.toggleOutline', title: '切换大纲', icon: '📑', action: () => emit('execute', { id: 'view.toggleOutline' } as Command) },
  
  // 导出
  { id: 'export.pdf', title: '导出为 PDF', icon: '📕', shortcut: '⌘P', action: () => emit('execute', { id: 'export.pdf' } as Command) },
  { id: 'export.wechat', title: '导出为微信格式', icon: '💬', action: () => emit('execute', { id: 'export.wechat' } as Command) },
  
  // 设置
  { id: 'settings.open', title: '打开设置', icon: '⚙️', shortcut: '⌘,', action: () => emit('execute', { id: 'settings.open' } as Command) },
]);

// 过滤命令
const filteredCommands = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return commands.value;
  
  return commands.value.filter(cmd => 
    cmd.title.toLowerCase().includes(query) ||
    cmd.id.toLowerCase().includes(query)
  );
});

// 选择操作
const selectNext = () => {
  if (selectedIndex.value < filteredCommands.value.length - 1) {
    selectedIndex.value++;
  }
};

const selectPrev = () => {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  }
};

const executeSelected = () => {
  if (filteredCommands.value[selectedIndex.value]) {
    executeCommand(filteredCommands.value[selectedIndex.value]);
  }
};

const executeCommand = (command: Command) => {
  command.action();
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
  background: white;
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
  border-bottom: 1px solid #e5e7eb;
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
}

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
  background: #f3f4f6;
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
  color: #1f2937;
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
