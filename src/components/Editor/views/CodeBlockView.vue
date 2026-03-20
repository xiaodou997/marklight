<template>
  <div class="code-block-wrapper group relative my-6 rounded-lg border border-gray-200 bg-gray-50 transition-all hover:border-blue-300">
    <!-- 顶部工具栏 -->
    <div class="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-xs text-gray-400">
      <!-- 语言选择器 -->
      <div class="relative">
        <button
          @click="toggleDropdown"
          class="font-mono uppercase tracking-wider outline-none cursor-pointer hover:text-blue-500 flex items-center gap-1"
        >
          <span>{{ selectedLang }}</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <!-- 下拉选择器 -->
        <div
          v-if="showDropdown"
          class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
        >
          <!-- 搜索框 -->
          <div class="p-2 border-b border-gray-100">
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="搜索语言..."
              class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
              @keydown.escape="closeDropdown"
              @keydown.enter="selectHighlighted"
              @keydown.down.prevent="navigateDown"
              @keydown.up.prevent="navigateUp"
            />
          </div>
          
          <!-- 语言列表 -->
          <div ref="listRef" class="max-h-48 overflow-y-auto">
            <button
              v-for="(lang, index) in filteredLanguages"
              :key="lang"
              :ref="el => setItemRef(el as HTMLElement, index)"
              @click="selectLanguage(lang)"
              @mouseenter="highlightedIndex = index"
              class="w-full px-3 py-1.5 text-left text-xs font-mono uppercase transition-colors"
              :class="[
                highlightedIndex === index ? 'bg-blue-100 text-blue-600' :
                selectedLang === lang ? 'bg-blue-50 text-blue-500' : 'text-gray-600 hover:bg-blue-50'
              ]"
            >
              {{ lang }}
            </button>
            
            <div v-if="filteredLanguages.length === 0" class="px-3 py-2 text-xs text-gray-400 text-center">
              无匹配语言
            </div>
          </div>
        </div>
      </div>
      
      <button
        @click="copyCode"
        class="opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-500 flex items-center gap-1"
      >
        <span>{{ copied ? '已复制' : '复制' }}</span>
      </button>
    </div>

    <!-- 代码内容挂载点 -->
    <pre class="overflow-x-auto p-4 text-sm"><code ref="contentRef" data-content-dom></code></pre>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: any) => void;
}>();

// 常用编程语言列表
const languages = [
  'text', 'plaintext',
  // 前端
  'javascript', 'typescript', 'html', 'css', 'scss', 'sass', 'less', 'vue', 'jsx', 'tsx', 'svelte',
  // 后端
  'python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin', 'scala',
  // 数据/配置
  'json', 'yaml', 'toml', 'xml', 'ini', 'dotenv',
  // 数据库
  'sql', 'mysql', 'postgresql', 'mongodb', 'redis',
  // Shell
  'bash', 'shell', 'powershell', 'cmd',
  // 其他
  'markdown', 'mdx', 'latex', 'dockerfile', 'nginx', 'apache', 'graphql', 'proto', 'thrift',
  // 数据科学
  'r', 'matlab', 'julia',
  // 移动端
  'dart', 'objectivec', 'gradle',
  // 标记语言
  'makefile', 'cmake', 'groovy', 'lua', 'perl', 'haskell', 'elixir', 'erlang', 'clojure', 'fsharp',
];

const selectedLang = ref(props.node.attrs.params || 'text');
const contentRef = ref<HTMLElement | null>(null);
const copied = ref(false);
const showDropdown = ref(false);
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const highlightedIndex = ref(0);

// 用于存储每个选项的 ref
const itemRefs = ref<Map<number, HTMLElement>>(new Map());

const setItemRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    itemRefs.value.set(index, el);
  }
};

// 过滤后的语言列表
const filteredLanguages = computed(() => {
  if (!searchQuery.value) {
    return languages;
  }
  const query = searchQuery.value.toLowerCase();
  return languages.filter(lang => lang.toLowerCase().includes(query));
});

// 切换下拉框
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) {
    highlightedIndex.value = 0;
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
};

// 关闭下拉框
const closeDropdown = () => {
  showDropdown.value = false;
  searchQuery.value = '';
  highlightedIndex.value = 0;
};

// 选择语言
const selectLanguage = (lang: string) => {
  selectedLang.value = lang;
  props.updateAttributes({ params: lang });
  closeDropdown();
};

// 选择高亮项
const selectHighlighted = () => {
  if (filteredLanguages.value.length > 0 && highlightedIndex.value >= 0) {
    selectLanguage(filteredLanguages.value[highlightedIndex.value]);
  }
};

// 向下导航
const navigateDown = () => {
  if (highlightedIndex.value < filteredLanguages.value.length - 1) {
    highlightedIndex.value++;
    scrollToHighlighted();
  }
};

// 向上导航
const navigateUp = () => {
  if (highlightedIndex.value > 0) {
    highlightedIndex.value--;
    scrollToHighlighted();
  }
};

// 滚动到高亮项
const scrollToHighlighted = () => {
  const el = itemRefs.value.get(highlightedIndex.value);
  if (el && listRef.value) {
    el.scrollIntoView({ block: 'nearest' });
  }
};

// 复制代码
const copyCode = async () => {
  const text = props.node.textContent;
  try {
    await writeText(text);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (e) {
    console.error('Copy failed:', e);
  }
};

// 重置高亮索引当搜索变化
watch(searchQuery, () => {
  highlightedIndex.value = 0;
});

// 点击外部关闭下拉框
watch(showDropdown, (show) => {
  if (show) {
    nextTick(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.code-block-wrapper')) {
          closeDropdown();
          document.removeEventListener('click', handler);
        }
      };
      setTimeout(() => {
        document.addEventListener('click', handler);
      }, 0);
    });
  }
});

defineExpose({
  contentRef
});
</script>

<style scoped>
.code-block-wrapper {
  cursor: text;
}
.code-block-wrapper pre {
  margin: 0;
  background: transparent;
  color: #24292e; /* GitHub 浅色模式基础文字色 */
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* 深色模式下的文字基础颜色 */
.code-block-wrapper.dark pre {
  color: #d1d5db;
}

.code-block-wrapper code {
  font-family: inherit;
  color: inherit;
}

/* 核心修复：仅针对未被具体高亮命中的 span，或可能导致变白的特殊类提供保底 */
/* 移除之前的全局 span { color: inherit } 以恢复 github.css 高亮 */
.code-block-wrapper pre :deep(.hljs-variable),
.code-block-wrapper pre :deep(.hljs-template-variable) {
  color: #e36209; /* 保持可见的橙色 */
}

/* 修复代码块内被误解析的标记样式 */
.code-block-wrapper pre :deep(strong),
.code-block-wrapper pre :deep(em),
.code-block-wrapper pre :deep(s),
.code-block-wrapper pre :deep(mark) {
  color: inherit !important;
  font-weight: normal !important;
  font-style: normal !important;
  text-decoration: none !important;
  background: none !important;
}
</style>
