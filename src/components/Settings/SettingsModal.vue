<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { confirm } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/settings';
import { WECHAT_THEMES } from '../../utils/wechat-themes';
import { isMac } from '../../utils/platform';
import {
  getCommand,
  getShortcutGroups,
  eventToKeyString,
  formatShortcutDisplay,
  checkKeyConflicts,
  type ShortcutDef,
} from '../../utils/shortcuts';
import ThemeSelector from './ThemeSelector.vue';
import ThemeEditor from './ThemeEditor.vue';

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


// Tab 切换动画
const tabs = [
  { key: 'appearance', label: '外观', icon: '🎨' },
  { key: 'editor', label: '编辑器', icon: '✏️' },
  { key: 'shortcuts', label: '快捷键', icon: '⌨️' },
  { key: 'save', label: '保存', icon: '💾' },
  { key: 'export', label: '导出', icon: '📤' },
];

const tabMeta = {
  appearance: {
    title: '外观与主题',
    description: '管理应用主题、字体与排版风格，让界面更贴近你的使用习惯。',
  },
  editor: {
    title: '编辑器偏好',
    description: '调整编辑器行为、显示细节和写作体验相关设置。',
  },
  shortcuts: {
    title: '快捷键',
    description: '查看并修改命令快捷键，建立更顺手的操作路径。',
  },
  save: {
    title: '保存策略',
    description: '控制自动保存与文件持久化行为。',
  },
  export: {
    title: '导出',
    description: '设置复制到微信等导出场景的排版风格。',
  },
} as const;

const activeTabMeta = computed(() => tabMeta[activeTab.value]);
const currentThemeName = computed(() => settingsStore.currentTheme?.name ?? '未选择主题');

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
async function handleReset() {
  const confirmed = await confirm('确定要恢复默认设置吗？', {
    title: '恢复默认',
    kind: 'warning'
  });
  if (confirmed) {
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
  editingKey.value = settings.customShortcuts[item.id] ?? item.defaultShortcut ?? '';
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
  const defaultDef = getCommand(item.id);
  if (defaultDef?.defaultShortcut && settings.customShortcuts[item.id]) {
    delete settings.customShortcuts[item.id];
  }
  conflictWarning.value = null;
}

// 重置所有快捷键
async function resetAllShortcuts() {
  const confirmed = await confirm('确定要重置所有快捷键为默认值吗？', {
    title: '重置快捷键',
    kind: 'warning'
  });
  if (confirmed) {
    settings.customShortcuts = {};
    conflictWarning.value = null;
  }
}

// 判断是否使用默认快捷键
function isDefaultShortcut(item: ShortcutDef): boolean {
  const defaultDef = getCommand(item.id);
  return !settings.customShortcuts[item.id]
    || settings.customShortcuts[item.id] === defaultDef?.defaultShortcut;
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
          class="rounded-xl shadow-2xl w-[1040px] max-w-[94vw] max-h-[84vh] overflow-hidden flex flex-col"
          style="background-color: var(--bg-color); color: var(--text-color);"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between px-7 py-5 border-b" style="border-color: var(--border-color);">
            <h2 class="text-lg font-semibold" style="color: var(--text-color);">设置</h2>
            <button
              class="p-1 rounded-lg transition-colors"
              style="color: var(--muted-color);"
              @mouseenter="($event.target as HTMLElement).style.backgroundColor = 'var(--hover-bg)'"
              @mouseleave="($event.target as HTMLElement).style.backgroundColor = ''"
              @click="close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex flex-1 overflow-hidden settings-shell">
            <!-- 侧边导航 -->
            <nav class="w-44 p-4 border-r shrink-0 settings-sidebar" style="border-color: var(--border-color);">
              <div class="settings-sidebar-label">偏好设置</div>
              <button
                v-for="tab in tabs"
                :key="tab.key"
                class="w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-colors flex items-center gap-2 settings-nav-btn"
                :style="activeTab === tab.key
                  ? 'background-color: rgba(99,102,241,0.1); color: var(--primary-color);'
                  : `color: var(--text-color);`"
                @mouseenter="activeTab !== tab.key && (($event.target as HTMLElement).style.backgroundColor = 'var(--hover-bg)')"
                @mouseleave="activeTab !== tab.key && (($event.target as HTMLElement).style.backgroundColor = '')"
                @click="activeTab = tab.key as any"
              >
                <span>{{ tab.icon }}</span>
                <span>{{ tab.label }}</span>
              </button>
            </nav>

            <!-- 设置内容 -->
            <div class="flex-1 overflow-y-auto settings-content-area" style="background-color: var(--bg-secondary);">
              <div class="settings-content">
                <div class="settings-page-header">
                  <div>
                    <h3 class="settings-page-title">{{ activeTabMeta.title }}</h3>
                    <p class="settings-page-desc">{{ activeTabMeta.description }}</p>
                  </div>
                  <div v-if="activeTab === 'appearance'" class="settings-page-badge">
                    当前主题：{{ currentThemeName }}
                  </div>
                </div>

              <!-- 外观设置 -->
              <div v-show="activeTab === 'appearance'" class="space-y-6">
                <section class="settings-section-card settings-section-card--hero">
                  <div>
                    <div class="settings-section-title">当前主题</div>
                    <p class="settings-section-desc">
                      主题选择会立即生效。默认先从主题库里挑选风格，只有在需要个性化时再进入高级编辑。
                    </p>
                  </div>
                  <div class="settings-hero-metrics">
                    <div class="settings-hero-chip">应用主题：{{ currentThemeName }}</div>
                    <div class="settings-hero-chip">字体：{{ settings.fontFamily }}</div>
                    <div class="settings-hero-chip">字号：{{ settings.fontSize }}px</div>
                  </div>
                </section>

                <section class="settings-section-card">
                  <div class="settings-section-heading">
                    <div>
                      <div class="settings-section-title">主题库</div>
                      <p class="settings-section-desc">所有主题默认直接展示，方便快速横向比较。</p>
                    </div>
                  </div>
                  <ThemeSelector />
                </section>

                <section class="settings-section-card">
                  <div class="settings-section-heading">
                    <div>
                      <div class="settings-section-title">主题定制</div>
                      <p class="settings-section-desc">复制当前主题后进入高级编辑，调整颜色并另存为新的自定义主题。</p>
                    </div>
                  </div>
                  <ThemeEditor />
                </section>

                <section class="settings-section-card">
                  <div class="settings-section-heading">
                    <div>
                      <div class="settings-section-title">排版与阅读</div>
                      <p class="settings-section-desc">统一控制字体、字号和行高，保持写作与阅读体验协调。</p>
                    </div>
                  </div>
                  <div class="settings-form-grid">
                    <div class="space-y-2 settings-form-item">
                      <label class="block text-sm font-medium" style="color: var(--text-color);">
                        字体大小: {{ settings.fontSize }}px
                      </label>
                      <input
                        v-model.number="settings.fontSize"
                        type="range"
                        min="12"
                        max="24"
                        step="1"
                        class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        style="background-color: var(--border-color);"
                      />
                      <div class="flex justify-between text-xs" style="color: var(--muted-color);">
                        <span>12px</span>
                        <span>24px</span>
                      </div>
                    </div>

                    <div class="space-y-2 settings-form-item">
                      <label class="block text-sm font-medium" style="color: var(--text-color);">字体族</label>
                      <select
                        v-model="settings.fontFamily"
                        class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        style="border-color: var(--border-color); background-color: var(--bg-color); color: var(--text-color);"
                      >
                        <option v-for="opt in fontOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>

                    <div class="space-y-2 settings-form-item">
                      <label class="block text-sm font-medium" style="color: var(--text-color);">
                        行高: {{ settings.lineHeight }}
                      </label>
                      <input
                        v-model.number="settings.lineHeight"
                        type="range"
                        min="1.2"
                        max="2.4"
                        step="0.1"
                        class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        style="background-color: var(--border-color);"
                      />
                    </div>
                  </div>
                </section>
              </div>

              <!-- 编辑器设置 -->
              <div v-show="activeTab === 'editor'" class="space-y-6">
                <div class="space-y-2">
                  <label class="block text-sm font-medium" style="color: var(--text-color);">编辑器引擎</label>
                  <div class="w-full px-3 py-2 border rounded-lg" style="border-color: var(--border-color); background-color: var(--sidebar-bg); color: var(--text-color);">
                    TipTap (ProseMirror)（已启用）
                  </div>
                  <p class="text-xs" style="color: var(--muted-color);">所见即所得编辑器引擎。</p>
                </div>

                <div class="flex items-center justify-between">
                  <div>
                    <label class="block text-sm font-medium" style="color: var(--text-color);">显示行号</label>
                    <p class="text-xs mt-1" style="color: var(--muted-color);">在编辑器左侧显示行号</p>
                  </div>
                  <button
                    @click="settings.showLineNumbers = !settings.showLineNumbers"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="settings.showLineNumbers ? 'bg-blue-500' : 'bg-gray-300'"
                  >
                    <span
                      class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                      :class="settings.showLineNumbers ? 'translate-x-7' : 'translate-x-1'"
                    />
                  </button>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium" style="color: var(--text-color);">
                    Tab 宽度: {{ settings.tabWidth }} 空格
                  </label>
                  <div class="flex gap-2">
                    <button
                      v-for="width in [2, 4]"
                      :key="width"
                      class="flex-1 py-2 rounded-lg border transition-colors"
                      :style="settings.tabWidth === width
                        ? 'border-color: var(--primary-color); background-color: rgba(99,102,241,0.08); color: var(--primary-color);'
                        : 'border-color: var(--border-color); color: var(--text-color);'"
                      @click="settings.tabWidth = width"
                    >
                      {{ width }} 空格
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <div>
                    <label class="block text-sm font-medium" style="color: var(--text-color);">拼写检查</label>
                    <p class="text-xs mt-1" style="color: var(--muted-color);">启用系统拼写检查</p>
                  </div>
                  <button
                    @click="settings.spellCheck = !settings.spellCheck"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="settings.spellCheck ? 'bg-blue-500' : 'bg-gray-300'"
                  >
                    <span
                      class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                      :class="settings.spellCheck ? 'translate-x-7' : 'translate-x-1'"
                    />
                  </button>
                </div>

                <div class="flex items-center justify-between">
                  <div>
                    <label class="block text-sm font-medium" style="color: var(--text-color);">大纲默认展开</label>
                    <p class="text-xs mt-1" style="color: var(--muted-color);">启动时自动展开侧边栏大纲</p>
                  </div>
                  <button
                    @click="settings.outlineExpanded = !settings.outlineExpanded"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="settings.outlineExpanded ? 'bg-blue-500' : 'bg-gray-300'"
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
                  <div class="text-sm" style="color: var(--muted-color);">
                    {{ isMac ? 'Mac 使用 ⌘ 键' : 'Windows/Linux 使用 Ctrl 键' }} · 点击行可修改快捷键
                  </div>
                  <button
                    class="text-xs"
                    style="color: var(--primary-color);"
                    @click="resetAllShortcuts"
                  >
                    重置全部
                  </button>
                </div>
                
                <!-- 冲突警告 -->
                <div v-if="conflictWarning" class="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                  ⚠️ {{ conflictWarning }}
                </div>
                
                <div v-for="group in shortcutGroups" :key="group.name" class="space-y-2">
                  <h3 class="text-sm font-semibold pb-1 border-b" style="color: var(--text-color); border-color: var(--border-color);">
                    {{ group.name }}
                  </h3>
                  <div class="grid gap-1.5">
                    <div
                      v-for="item in group.items"
                      :key="item.id"
                      class="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-all"
                      :style="editingId === item.id
                        ? 'background-color: rgba(99,102,241,0.08); outline: 2px solid var(--primary-color);'
                        : 'background-color: var(--sidebar-bg);'"
                      @click="startEdit(item)"
                    >
                      <span class="text-sm" style="color: var(--text-color);">{{ item.description }}</span>
                      
                      <!-- 快捷键显示/编辑 -->
                      <div class="flex items-center gap-1.5">
                        <!-- 重置按钮 -->
                        <button
                          v-if="!isDefaultShortcut(item)"
                          class="w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
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
                          data-shortcut-capture="true"
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
                          {{ formatShortcutDisplay(item.shortcut) }}
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
                    <label class="block text-sm font-medium" style="color: var(--text-color);">自动保存</label>
                    <p class="text-xs mt-1" style="color: var(--muted-color);">编辑时自动保存文件</p>
                  </div>
                  <button
                    @click="settings.autoSave = !settings.autoSave"
                    class="relative w-12 h-6 rounded-full transition-colors"
                    :class="settings.autoSave ? 'bg-blue-500' : 'bg-gray-300'"
                  >
                    <span
                      class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                      :class="settings.autoSave ? 'translate-x-7' : 'translate-x-1'"
                    />
                  </button>
                </div>

                <div v-if="settings.autoSave" class="space-y-2">
                  <label class="block text-sm font-medium" style="color: var(--text-color);">
                    保存间隔: {{ settings.autoSaveInterval }} 秒
                  </label>
                  <input
                    v-model.number="settings.autoSaveInterval"
                    type="range"
                    min="10"
                    max="120"
                    step="10"
                    class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    style="background-color: var(--border-color);"
                  />
                  <div class="flex justify-between text-xs" style="color: var(--muted-color);">
                    <span>10秒</span>
                    <span>120秒</span>
                  </div>
                </div>
              </div>

              <!-- 导出设置 -->
              <div v-show="activeTab === 'export'" class="space-y-6">
                <div class="space-y-2">
                  <label class="block text-sm font-medium" style="color: var(--text-color);">导出主题</label>
                  <p class="text-xs mt-1" style="color: var(--muted-color);">选择复制到微信时的排版风格</p>

                  <div class="grid grid-cols-2 gap-3 mt-3">
                    <button
                      v-for="theme in WECHAT_THEMES"
                      :key="theme.id"
                      class="p-3 rounded-lg border-2 transition-all text-left"
                      :style="settings.wechatTheme === theme.id
                        ? 'border-color: var(--primary-color); background-color: rgba(99,102,241,0.08);'
                        : 'border-color: var(--border-color);'"
                      @click="settings.wechatTheme = theme.id"
                    >
                      <div class="flex items-center gap-2 mb-2">
                        <span
                          class="w-4 h-4 rounded-full"
                          :style="{ backgroundColor: theme.colors.primary }"
                        ></span>
                        <span class="text-sm font-medium" style="color: var(--text-color);">{{ theme.name }}</span>
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
          </div>

          <!-- 底部 -->
          <div class="flex items-center justify-between px-7 py-4 border-t settings-footer" style="border-color: var(--border-color); background-color: var(--sidebar-bg);">
            <button
              class="px-4 py-2 text-sm transition-colors"
              style="color: var(--muted-color);"
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

.settings-shell {
  min-height: 0;
}

.settings-sidebar {
  background: color-mix(in srgb, var(--bg-color) 92%, white 8%);
}

.settings-sidebar-label {
  margin-bottom: 12px;
  padding: 0 4px;
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-nav-btn {
  font-weight: 600;
}

.settings-content-area {
  min-width: 0;
}

.settings-content {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 28px 28px 32px;
}

.settings-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.settings-page-title {
  margin: 0;
  color: var(--text-color);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.settings-page-desc {
  margin: 8px 0 0;
  color: var(--muted-color);
  font-size: 14px;
  line-height: 1.7;
}

.settings-page-badge {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-color);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
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
    radial-gradient(circle at top right, color-mix(in srgb, var(--primary-light) 85%, transparent 15%), transparent 45%),
    var(--bg-color);
}

.settings-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.settings-section-title {
  color: var(--text-color);
  font-size: 15px;
  font-weight: 700;
}

.settings-section-desc {
  margin: 6px 0 0;
  color: var(--muted-color);
  font-size: 13px;
  line-height: 1.7;
}

.settings-hero-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.settings-hero-chip {
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
}

.settings-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.settings-form-item {
  min-width: 0;
}

.settings-footer {
  box-shadow: 0 -1px 0 rgba(15, 23, 42, 0.02);
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

@media (max-width: 960px) {
  .settings-page-header,
  .settings-section-card--hero {
    flex-direction: column;
  }

  .settings-hero-metrics {
    justify-content: flex-start;
  }

  .settings-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
