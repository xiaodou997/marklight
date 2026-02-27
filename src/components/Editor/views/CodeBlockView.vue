<template>
  <div class="code-block-wrapper group relative my-6 rounded-lg border border-gray-200 bg-gray-50 transition-all hover:border-blue-300">
    <!-- 顶部工具栏 -->
    <div class="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-xs text-gray-400">
      <select
        v-model="selectedLang"
        class="bg-transparent font-mono uppercase tracking-wider outline-none cursor-pointer hover:text-blue-500"
        @change="updateLanguage"
      >
        <option v-for="lang in languages" :key="lang" :value="lang">{{ lang }}</option>
      </select>
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
import { ref } from 'vue';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: any) => void;
}>();

const languages = ['text', 'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'html', 'css', 'json', 'bash', 'sql', 'markdown', 'vue', 'react'];
const selectedLang = ref(props.node.attrs.params || 'text');
const contentRef = ref<HTMLElement | null>(null);
const copied = ref(false);

const updateLanguage = () => {
  props.updateAttributes({ params: selectedLang.value });
};

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
