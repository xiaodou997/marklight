<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import { WECHAT_THEMES } from '../../utils/wechat-themes';

const settingsStore = useSettingsStore();
const settings = settingsStore.settings;

// 当前选中的设置分组
const activeTab = ref<'appearance' | 'editor' | 'save' | 'export'>('appearance');

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
];

// Tab 切换动画
const tabs = [
  { key: 'appearance', label: '外观', icon: '🎨' },
  { key: 'editor', label: '编辑器', icon: '✏️' },
  { key: 'save', label: '保存', icon: '💾' },
  { key: 'export', label: '导出', icon: '📤' },
];

// 关闭弹窗
function close() {
  settingsStore.closeModal();
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
