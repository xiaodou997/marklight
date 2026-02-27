<template>
  <div class="sidebar-container h-full flex flex-col bg-gray-50 border-r border-gray-100 select-none">
    <!-- 标签切换 -->
    <div class="flex border-b border-gray-200 bg-white">
      <button 
        @click="$emit('update:mode', 'outline')"
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="mode === 'outline' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'"
      >
        大纲
      </button>
      <button 
        @click="$emit('update:mode', 'files')"
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="mode === 'files' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'"
      >
        文件
      </button>
    </div>

    <!-- 大纲模式 -->
    <div v-if="mode === 'outline'" class="flex-1 overflow-y-auto p-4">
      <div v-if="outlineItems.length === 0" class="text-xs text-gray-400 px-2 italic">
        暂无标题
      </div>
      <nav class="space-y-1">
        <div
          v-for="item in outlineItems"
          :key="item.pos"
          @click="$emit('scroll-to', item.pos)"
          :style="{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }"
          class="group flex items-center py-1.5 px-2 rounded-md text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors"
        >
          <span class="truncate">{{ item.text }}</span>
        </div>
      </nav>
    </div>

    <!-- 文件树模式 -->
    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <div v-if="!currentFolder" class="flex-1 p-4 text-xs text-gray-400 italic">
        请打开文件夹以查看文件列表
        <button 
          @click="$emit('open-folder')"
          class="block mt-2 text-blue-500 hover:underline"
        >
          打开文件夹
        </button>
      </div>
      <template v-else>
        <!-- 固定在顶部的操作栏 -->
        <div class="flex-shrink-0 bg-white border-b border-gray-100">
          <!-- 搜索框 -->
          <div class="px-3 py-2">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索文件..."
              class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
            />
          </div>
          <!-- 返回上级按钮 -->
          <div 
            @click="$emit('navigate-up')"
            class="flex items-center py-1.5 px-3 text-xs text-gray-500 hover:bg-gray-100 cursor-pointer"
          >
            <span class="mr-1.5">⬆️</span>
            <span class="truncate">返回上级</span>
          </div>
        </div>
        
        <!-- 文件列表（可滚动） -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="filteredFiles.length === 0" class="p-4 text-xs text-gray-400 italic">
            {{ searchQuery ? '没有匹配的文件' : '当前文件夹为空' }}
          </div>
          <nav v-else class="py-1">
            <div
              v-for="file in filteredFiles"
              :key="file.path"
              @click="handleFileClick(file, $event)"
              class="flex items-center py-1.5 px-3 text-sm cursor-pointer transition-colors"
              :class="[
                file.path === currentFilePath 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100',
                file.is_dir ? 'font-medium' : ''
              ]"
            >
              <!-- 图标 -->
              <span class="mr-2 text-sm">
                <template v-if="file.is_dir">📁</template>
                <template v-else-if="file.is_md">📝</template>
                <template v-else>📄</template>
              </span>
              <span class="truncate">{{ file.name }}</span>
            </div>
          </nav>
        </div>
      </template>
    </div>

    <!-- 底部路径面包屑 -->
    <div v-if="mode === 'files' && currentFolder" class="border-t border-gray-200 bg-white px-2 py-1.5">
      <div class="flex items-center text-[10px] text-gray-400 flex-wrap">
        <template v-for="(segment, index) in pathSegments" :key="index">
          <span 
            v-if="index > 0" 
            class="mx-0.5 text-gray-300"
          >/</span>
          <span 
            @click="handlePathClick(index)"
            class="cursor-pointer hover:text-blue-500 transition-colors"
            :class="{ 'text-gray-600 font-medium': index === pathSegments.length - 1 }"
          >{{ segment.name }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

export interface OutlineItem {
  text: string;
  level: number;
  pos: number;
}

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_md: boolean;
}

const props = defineProps<{
  mode: 'outline' | 'files';
  outlineItems: OutlineItem[];
  files: FileInfo[];
  currentFolder: string | null;
  currentFilePath: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:mode', mode: 'outline' | 'files'): void;
  (e: 'scroll-to', pos: number): void;
  (e: 'open-folder'): void;
  (e: 'open-file', path: string): void;
  (e: 'open-file-in-new-window', path: string): void;
  (e: 'navigate-folder', path: string): void;
  (e: 'navigate-up'): void;
}>();

const searchQuery = ref('');

// 过滤文件
const filteredFiles = computed(() => {
  if (!searchQuery.value) return props.files;
  const query = searchQuery.value.toLowerCase();
  return props.files.filter(file => 
    file.name.toLowerCase().includes(query)
  );
});

// 路径分段
const pathSegments = computed(() => {
  if (!props.currentFolder) return [];
  const parts = props.currentFolder.split('/').filter(Boolean);
  let path = '';
  return parts.map(name => {
    path = path ? `${path}/${name}` : `/${name}`;
    return { name, path };
  });
});

function handleFileClick(file: FileInfo, event?: MouseEvent) {
  // Cmd (macOS) 或 Ctrl (Windows/Linux) + 单击：在新窗口打开
  if (event && (event.metaKey || event.ctrlKey) && !file.is_dir) {
    emit('open-file-in-new-window', file.path);
    return;
  }
  
  if (file.is_dir) {
    emit('navigate-folder', file.path);
  } else {
    emit('open-file', file.path);
  }
}

function handlePathClick(index: number) {
  const segment = pathSegments.value[index];
  if (segment) {
    emit('navigate-folder', segment.path);
  }
}
</script>
