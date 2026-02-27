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
          class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
        >
          <!-- 搜索框 -->
          <div class="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="搜索语言..."
              class="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-400 dark:bg-gray-700 dark:text-white"
              @keydown.escape="closeDropdown"
              @keydown.enter="selectFirst"
            />
          </div>
          
          <!-- 语言列表 -->
          <div class="max-h-48 overflow-y-auto">
            <button
              v-for="lang in filteredLanguages"
              :key="lang"
              @click="selectLanguage(lang)"
              class="w-full px-3 py-1.5 text-left text-xs font-mono uppercase hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
              :class="selectedLang === lang ? 'bg-blue-50 dark:bg-gray-700 text-blue-500' : 'text-gray-600 dark:text-gray-300'"
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
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
};

// 关闭下拉框
const closeDropdown = () => {
  showDropdown.value = false;
  searchQuery.value = '';
};

// 选择语言
const selectLanguage = (lang: string) => {
  selectedLang.value = lang;
  props.updateAttributes({ params: lang });
  closeDropdown();
};

// 选择第一个匹配项
const selectFirst = () => {
  if (filteredLanguages.value.length > 0) {
    selectLanguage(filteredLanguages.value[0]);
  }
};

// 复制代码
const copyCode = async () => {
  const text = props.node.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (e) {
    console.error('Copy failed:', e);
  }
};

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
  color: #1f2937;
}
.code-block-wrapper code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: inherit;
}
</style>