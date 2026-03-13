<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import { WECHAT_THEMES } from '../../utils/wechat-themes';
import { isMac } from '../../utils/platform';
import { getShortcutGroups, eventToKeyString, formatShortcutDisplay, checkKeyConflicts, type ShortcutDef, DEFAULT_SHORTCUTS } from '../Editor/core/plugins/shortcuts';

const settingsStore = useSettingsStore();
const settings = settingsStore.settings;

// 当前选中的设置分组
const activeTab = ref<'appearance' | 'editor' | 'shortcuts' | 'save' | 'export'>('appearance');

// 快捷键编辑状态
const editingId = ref<string | null>(null);
const editingKey = ref<string>('');
const conflictWarning = ref<string | null>(null);
const captureInputRef = ref<HTMLInputElement | null>(null);

// 获取快捷键列表并按分组
const shortcutGroups = computed(() => {
  return getShortcutGroups(settings.customShortcuts);
});

// 字体选项
const fontOptions = [
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Source Code Pro', label: 'Source Code Pro' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'Menlo', label: 'Menlo' },
  { value: 'Monaco', label: 'Monaco' },
];

// 主题选项
const themeOptions = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
  { value: 'custom', label: '自定义' },
];

const customThemeLabels = {
  primary: '品牌主色',
  background: '背景颜色',
  text: '文字颜色',
  sidebar: '侧边栏背景',
  border: '边框颜色',
};

// Tab 切换动画
const tabs = [
  { key: 'appearance', label: '外观', icon: '🎨' },
  { key: 'editor', label: '编辑器', icon: '✏️' },
  { key: 'shortcuts', label: '快捷键', icon: '⌨️' },
  { key: 'save', label: '保存', icon: '💾' },
  { key: 'export', label: '导出', icon: '📤' },
];

// 关闭弹窗
function close() {
  settingsStore.closeModal();
  cancelEdit();
}

// 点击遮罩关闭
function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close();
  }
}

// 重置设置
function handleReset() {
  if (confirm('确定要恢复默认设置吗？')) {
    settingsStore.resetSettings();
  }
}

// 快捷键关闭
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close();
  }
}

// 开始编辑快捷键
function startEdit(item: ShortcutDef) {
  editingId.value = item.id;
  editingKey.value = item.key;
  conflictWarning.value = null;
  
  nextTick(() => {
    captureInputRef.value?.focus();
  });
}

// 取消编辑
function cancelEdit() {
  editingId.value = null;
  editingKey.value = '';
  conflictWarning.value = null;
}

// 捕获快捷键
function captureKeydown(event: KeyboardEvent, item: ShortcutDef) {
  // 忽略单独的修饰键
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(event.key)) {
    return;
  }
  
  // Escape 取消编辑
  if (event.key === 'Escape') {
    cancelEdit();
    return;
  }
  
  event.preventDefault();
  event.stopPropagation();
  
  const keyStr = eventToKeyString(event);
  
  // 检查是否只是修饰键（没有实际按键）
  if (keyStr.endsWith('Mod-') || keyStr.endsWith('Shift-') || keyStr.endsWith('Alt-')) {
    return;
  }
  
  // 检测冲突
  const newCustom = { ...settings.customShortcuts, [item.id]: keyStr };
  const conflicts = checkKeyConflicts(newCustom);
  
  if (conflicts.length > 0) {
    const conflictItems = conflicts
      .filter(c => c.id !== item.id)
      .map(c => c.description);
    
    if (conflictItems.length > 0) {
      conflictWarning.value = `快捷键冲突: ${conflictItems.join(', ')}`;
    }
  } else {
    conflictWarning.value = null;
  }
  
  // 更新快捷键
  settings.customShortcuts[item.id] = keyStr;
  editingKey.value = keyStr;
}

// 重置单个快捷键
function resetShortcut(item: ShortcutDef) {
  const defaultDef = DEFAULT_SHORTCUTS.find(d => d.id === item.id);
  if (defaultDef) {
    // 如果是默认值，删除自定义配置
    if (settings.customShortcuts[item.id]) {
      delete settings.customShortcuts[item.id];
    }
  }
  conflictWarning.value = null;
}

// 重置所有快捷键
function resetAllShortcuts() {
  if (confirm('确定要重置所有快捷键为默认值吗？')) {
    settings.customShortcuts = {};
    conflictWarning.value = null;
  }
}

// 判断是否使用默认快捷键
function isDefaultShortcut(item: ShortcutDef): boolean {
  const defaultDef = DEFAULT_SHORTCUTS.find(d => d.id === item.id);
  return !settings.customShortcuts[item.id] || settings.customShortcuts[item.id] === defaultDef?.key;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="settingsStore.isModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        @click="onOverlayClick"
        @keydown="onKeyDown"
        tabindex="-1"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">设置</h2>
            <button
              class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              @click="close"
            >
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex flex-1 overflow-hidden">
            <!-- 侧边导航 -->
            <nav class="w-36 p-4 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                class="w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors flex items-center gap-2"
                :class="activeTab === tab.key 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'"
                @click="activeTab = tab.key as any"
              >
                <span>{{ tab.icon }}</span>
                <span>{{ tab.label }}</span>
              </button>
            </nav>

            <!-- 设置内容 -->
            <div class="flex-1 p-6 overflow-y-auto">
              <!-- 外观设置 -->
              <div v-show="activeTab === 'appearance'" class="space-y-6">
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">主题</label>
                  <select
                    v-model="settings.theme"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option v-for="opt in themeOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <!-- 自定义主题配色 -->
                <div v-if="settings.theme === 'custom'" class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                  <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider">自定义配色</h4>
                  <div class="grid grid-cols-2 gap-4">
                    <div v-for="(label, key) in customThemeLabels" :key="key" class="space-y-1.5">
                      <label class="text-[11px] font-medium text-gray-500 dark:text-gray-400 ml-1">{{ label }}</label>
                      <div class="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <input
                          v-model="settings.customTheme[key as keyof typeof settings.customTheme]"
                          type="color"
                          class="w-6 h-6 border-0 p-0 bg-transparent cursor-pointer rounded overflow-hidden"
                        />
                        <input
                          v-model="settings.customTheme[key as keyof typeof settings.customTheme]"
                          type="text"
                          class="flex-1 min-w-0 bg-transparent border-0 p-0 text-xs font-mono focus:ring-0 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    字体大小: {{ settings.fontSize }}px
                  </label>
                  <input
                    v-model.number="settings.fontSize"
                    type="range"
                    min="12"
                    max="24"
                    step="1"
                    class="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div class="flex justify-between text-xs text-gray-500">
                    <span>12px</span>
                    <span>24px</span>
                  </div>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">字体族</label>
                  <select
                    v-model="settings.fontFamily"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  >
                    <option v-for="opt in fontOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    行高: {{ settings.lineHeight }}
                  </label>
                  <input
                    v-model.number="settings.lineHeight"
                    type="range"
                    min="1.2"
                    max="2.4"
                    step="0.1"
                    class="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              <!-- 编辑器设置 -->
              <div v-show="activeTab === 'editor'" class="space-y-6">
                <div class="flex items-center justify-between">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">显示行号</label>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">在编辑器左侧显示行号</p>
                  </div>
                  <button
                    @click="settings.showLineNumbers = !settings.showLineNumbers"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="settings.showLineNumbers ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'"
                  >
                    <span
                      class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                      :class="settings.showLineNumbers ? 'translate-x-7' : 'translate-x-1'"
                    />
                  </button>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tab 宽度: {{ settings.tabWidth }} 空格
                  </label>
                  <div class="flex gap-2">
                    <button
                      v-for="width in [2, 4]"
                      :key="width"
                      class="flex-1 py-2 rounded-lg border transition-colors"
                      :class="settings.tabWidth === width 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
                      @click="settings.tabWidth = width"
                    >
                      {{ width }} 空格
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">拼写检查</label>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">启用系统拼写检查</p>
                  </div>
                  <button
                    @click="settings.spellCheck = !settings.spellCheck"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="settings.spellCheck ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'"
                  >
                    <span
                      class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                      :class="settings.spellCheck ? 'translate-x-7' : 'translate-x-1'"
                    />
                  </button>
                </div>

                <div class="flex items-center justify-between">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">大纲默认展开</label>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">启动时自动展开侧边栏大纲</p>
                  </div>
                  <button
                    @click="settings.outlineExpanded = !settings.outlineExpanded"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="settings.outlineExpanded ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'"
                  >
                    <span
                      class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                      :class="settings.outlineExpanded ? 'translate-x-7' : 'translate-x-1'"
                    />
                  </button>
                </div>
              </div>

              <!-- 快捷键设置 -->
              <div v-show="activeTab === 'shortcuts'" class="space-y-4">
                <div class="flex items-center justify-between">
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ isMac ? 'Mac 使用 ⌘ 键' : 'Windows/Linux 使用 Ctrl 键' }} · 点击行可修改快捷键
                  </div>
                  <button
                    class="text-xs text-blue-500 hover:text-blue-600"
                    @click="resetAllShortcuts"
                  >
                    重置全部
                  </button>
                </div>
                
                <!-- 冲突警告 -->
                <div v-if="conflictWarning" class="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                  ⚠️ {{ conflictWarning }}
                </div>
                
                <div v-for="group in shortcutGroups" :key="group.name" class="space-y-2">
                  <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-1">
                    {{ group.name }}
                  </h3>
                  <div class="grid gap-1.5">
                    <div 
                      v-for="item in group.items" 
                      :key="item.id"
                      class="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-all"
                      :class="editingId === item.id 
                        ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' 
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'"
                      @click="startEdit(item)"
                    >
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ item.description }}</span>
                      
                      <!-- 快捷键显示/编辑 -->
                      <div class="flex items-center gap-1.5">
                        <!-- 重置按钮 -->
                        <button
                          v-if="!isDefaultShortcut(item)"
                          class="w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          title="重置为默认"
                          @click.stop="resetShortcut(item)"
                        >
                          ↺
                        </button>
                        
                        <!-- 快捷键输入框（编辑状态） -->
                        <input
                          v-if="editingId === item.id"
                          ref="captureInputRef"
                          type="text"
                          readonly
                          :value="formatShortcutDisplay(editingKey)"
                          class="shortcut-input editing"
                          placeholder="按下..."
                          @keydown="captureKeydown($event, item)"
                          @blur="cancelEdit"
                        />
                        
                        <!-- 快捷键显示（非编辑状态） -->
                        <div
                          v-else
                          class="shortcut-input"
                          :class="{ 'custom': !isDefaultShortcut(item) }"
                        >
                          {{ formatShortcutDisplay(item.key) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 保存设置 -->
              <div v-show="activeTab === 'save'" class="space-y-6">
                <div class="flex items-center justify-between">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">自动保存</label>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">编辑时自动保存文件</p>
                  </div>
                  <button
                    @click="settings.autoSave = !settings.autoSave"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="settings.autoSave ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'"
                  >
                    <span
                      class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                      :class="settings.autoSave ? 'translate-x-7' : 'translate-x-1'"
                    />
                  </button>
                </div>

                <div v-if="settings.autoSave" class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    保存间隔: {{ settings.autoSaveInterval }} 秒
                  </label>
                  <input
                    v-model.number="settings.autoSaveInterval"
                    type="range"
                    min="10"
                    max="120"
                    step="10"
                    class="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div class="flex justify-between text-xs text-gray-500">
                    <span>10秒</span>
                    <span>120秒</span>
                  </div>
                </div>
              </div>

              <!-- 导出设置 -->
              <div v-show="activeTab === 'export'" class="space-y-6">
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">微信导出主题</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">选择复制到微信时的排版风格</p>
                  
                  <div class="grid grid-cols-2 gap-3 mt-3">
                    <button
                      v-for="theme in WECHAT_THEMES"
                      :key="theme.id"
                      class="p-3 rounded-lg border-2 transition-all text-left"
                      :class="settings.wechatTheme === theme.id 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
                      @click="settings.wechatTheme = theme.id"
                    >
                      <div class="flex items-center gap-2 mb-2">
                        <span 
                          class="w-4 h-4 rounded-full" 
                          :style="{ backgroundColor: theme.colors.primary }"
                        ></span>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ theme.name }}</span>
                      </div>
                      <div class="flex gap-1">
                        <span 
                          class="w-6 h-2 rounded" 
                          :style="{ backgroundColor: theme.colors.primary }"
                        ></span>
                        <span 
                          class="w-6 h-2 rounded" 
                          :style="{ backgroundColor: theme.colors.primaryDark }"
                        ></span>
                        <span 
                          class="w-6 h-2 rounded" 
                          :style="{ backgroundColor: theme.colors.codeBg }"
                        ></span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部 -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <button
              class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              @click="handleReset"
            >
              恢复默认
            </button>
            <button
              class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
              @click="close"
            >
              完成
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

/* 快捷键输入框样式 */
.shortcut-input {
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

.dark .shortcut-input {
  background: #1f2937;
  border-color: #4b5563;
  color: #d1d5db;
}

.shortcut-input.custom {
  color: #2563eb;
  border-color: #60a5fa;
}

.dark .shortcut-input.custom {
  color: #60a5fa;
  border-color: #3b82f6;
}

.shortcut-input.editing {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
  outline: none;
}

.dark .shortcut-input.editing {
  background: #1e3a5f;
  border-color: #60a5fa;
  color: #93c5fd;
}

/* Range input 样式 */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}
</style>