<template>
  <div 
    class="titlebar select-none flex items-center justify-between h-9 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800"
    data-tauri-drag-region
  >
    <div class="flex items-center h-full pl-2 space-x-1" data-tauri-drag-region>
      <img src="/icon.png" class="w-4 h-4 mr-2" alt="Logo" data-tauri-drag-region />
      
      <!-- 菜单栏 -->
      <div class="flex items-center h-full">
        <div 
          v-for="menu in menus" 
          :key="menu.id"
          class="relative h-full flex items-center px-3 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-default"
          @mouseenter="onMenuHover(menu.id)"
          @mousedown.stop="toggleMenu(menu.id)"
        >
          {{ menu.label }}
          
          <!-- 下拉菜单内容 -->
          <div 
            v-if="activeMenu === menu.id" 
            class="absolute top-full left-0 w-48 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-b shadow-lg z-50"
            @mousedown.stop
          >
            <template v-for="(item, idx) in menu.items" :key="idx">
              <div 
                v-if="item.type === 'separator'" 
                class="my-1 border-t border-zinc-200 dark:border-zinc-700"
              ></div>
              <div 
                v-else 
                class="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-blue-600 hover:text-white cursor-default group"
                @click="handleMenuClick(item.id)"
              >
                <span>{{ item.label }}</span>
                <span class="text-[10px] text-zinc-400 group-hover:text-blue-100 ml-4">{{ item.shortcut }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 窗口控制按钮 -->
    <div class="flex items-center h-full">
      <div @click="minimize" class="control-btn hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <svg class="w-3 h-3" viewBox="0 0 12 12"><rect fill="currentColor" width="10" height="1" x="1" y="6"/></svg>
      </div>
      <div @click="toggleMaximize" class="control-btn hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <svg class="w-3 h-3" viewBox="0 0 12 12"><rect fill="currentColor" width="9" height="9" x="1.5" y="1.5" stroke="currentColor" stroke-width="1" fill-opacity="0"/></svg>
      </div>
      <div @click="close" class="control-btn hover:bg-red-500 hover:text-white group">
        <svg class="w-3 h-3" viewBox="0 0 12 12"><path fill="currentColor" d="M10.5 1.5l-9 9m0-9l9 9" stroke="currentColor" stroke-width="1.2"/></svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';

const isMacOS = ref(false);
const activeMenu = ref<string | null>(null);
const isMenuOpen = ref(false);

const appWindow = getCurrentWindow();

// 检测是否为 macOS
onMounted(async () => {
  const platform = await import('@tauri-apps/plugin-os').then(m => m.platform());
  isMacOS.value = platform() === 'macos';
  
  // 点击外部关闭菜单
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
  emit('menu-event', id);
  closeAllMenus();
};

// 窗口操作
const minimize = () => appWindow.minimize();
const toggleMaximize = () => appWindow.toggleMaximize();
const close = () => emit('window-close-requested');

// 菜单数据定义 (对齐 macOS)
const menus = [
  {
    id: 'file',
    label: '文件',
    items: [
      { id: 'new', label: '新建', shortcut: 'Ctrl+N' },
      { id: 'new_window', label: '新建窗口', shortcut: 'Ctrl+Alt+N' },
      { id: 'open', label: '打开...', shortcut: 'Ctrl+O' },
      { type: 'separator' },
      { id: 'save', label: '保存', shortcut: 'Ctrl+S' },
      { id: 'save_as', label: '另存为...', shortcut: 'Ctrl+Shift+S' },
      { type: 'separator' },
      { id: 'export_html', label: '导出为 HTML', shortcut: '' },
      { id: 'export_pdf', label: '导出为 PDF...', shortcut: 'Ctrl+Shift+P' },
      { id: 'export_wechat', label: '微信导出', shortcut: 'Ctrl+E' },
    ]
  },
  {
    id: 'edit',
    label: '编辑',
    items: [
      { id: 'undo', label: '撤销', shortcut: 'Ctrl+Z' },
      { id: 'redo', label: '重做', shortcut: 'Ctrl+Y' },
      { type: 'separator' },
      { id: 'cut', label: '剪切', shortcut: 'Ctrl+X' },
      { id: 'copy', label: '复制', shortcut: 'Ctrl+C' },
      { id: 'paste', label: '粘贴', shortcut: 'Ctrl+V' },
      { type: 'separator' },
      { id: 'find', label: '查找', shortcut: 'Ctrl+F' },
      { id: 'replace', label: '替换', shortcut: 'Ctrl+H' },
    ]
  },
  {
    id: 'view',
    label: '视图',
    items: [
      { id: 'toggle_sidebar', label: '侧边栏', shortcut: 'Ctrl+\\' },
      { id: 'sidebar_outline', label: '  └ 大纲', shortcut: 'Ctrl+1' },
      { id: 'sidebar_files', label: '  └ 文件树', shortcut: 'Ctrl+2' },
      { type: 'separator' },
      { id: 'toggle_source', label: '源码模式', shortcut: 'Ctrl+/' },
      { id: 'focus_mode', label: '焦点模式', shortcut: 'Ctrl+Shift+F' },
      { type: 'separator' },
      { id: 'fullscreen', label: '全屏', shortcut: 'F11' },
    ]
  },
  {
    id: 'help',
    label: '帮助',
    items: [
      { id: 'shortcuts', label: '快捷键', shortcut: 'Ctrl+K Ctrl+S' },
      { type: 'separator' },
      { id: 'github', label: '项目主页 (GitHub)', shortcut: '' },
      { id: 'gitee', label: '项目主页 (Gitee)', shortcut: '' },
      { id: 'issues', label: '报告问题', shortcut: '' },
      { type: 'separator' },
      { id: 'about', label: '关于 MarkLight', shortcut: '' },
    ]
  }
];
</script>

<style scoped>
@reference "../../assets/styles/main.css";

.control-btn {
  @apply w-11 h-full flex items-center justify-center transition-colors duration-150 text-zinc-600 dark:text-zinc-400;
}
</style>
