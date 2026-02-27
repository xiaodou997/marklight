<template>
  <div 
    v-show="visible"
    ref="menuRef"
    class="fixed z-50 flex flex-col rounded-lg border border-gray-200 bg-white p-1 shadow-xl transition-all duration-200"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px`, transform: 'translate(-50%, -120%)' }"
  >
    <!-- 主工具栏 -->
    <div class="flex items-center gap-1">
      <button @click="exec('bold')" :class="btnClass(activeMarks.bold)" title="加粗">
        <span class="font-bold text-lg">B</span>
      </button>
      <button @click="exec('italic')" :class="btnClass(activeMarks.italic)" title="斜体">
        <span class="italic text-lg">I</span>
      </button>
      <button @click="exec('code')" :class="btnClass(activeMarks.code)" title="行内代码">
        <span class="font-mono text-sm">&lt;/&gt;</span>
      </button>
      <button @click="toggleLinkInput" :class="btnClass(activeMarks.link)" title="链接">
        <span>🔗</span>
      </button>
      <div class="mx-1 h-4 w-px bg-gray-200"></div>
      <button @click="exec('h1')" class="px-2 py-1 text-xs hover:bg-gray-100 rounded">H1</button>
      <button @click="exec('h2')" class="px-2 py-1 text-xs hover:bg-gray-100 rounded">H2</button>
    </div>
    
    <!-- 链接输入区 -->
    <div v-if="showLinkInput" class="mt-1 flex items-center gap-1 border-t border-gray-100 pt-1">
      <input
        ref="linkInputRef"
        v-model="linkUrl"
        type="url"
        placeholder="输入链接地址..."
        class="w-48 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
        @keydown.enter="applyLink"
        @keydown.escape="cancelLink"
      />
      <button 
        @click="applyLink" 
        class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        确定
      </button>
      <button 
        v-if="activeMarks.link"
        @click="removeLink" 
        class="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
      >
        移除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue';

const props = defineProps<{
  onAction: (type: string, data?: any) => void;
}>();

const visible = ref(false);
const pos = reactive({ left: 0, top: 0 });
const activeMarks = reactive({
  bold: false,
  italic: false,
  code: false,
  link: false
});

// 链接输入相关
const showLinkInput = ref(false);
const linkUrl = ref('');
const linkInputRef = ref<HTMLInputElement | null>(null);

const btnClass = (active: boolean) => [
  'flex h-8 w-8 items-center justify-center rounded transition-colors',
  active ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
];

const exec = (type: string) => {
  props.onAction(type);
};

// 切换链接输入区
const toggleLinkInput = () => {
  showLinkInput.value = !showLinkInput.value;
  if (showLinkInput.value) {
    nextTick(() => {
      linkInputRef.value?.focus();
    });
  }
};

// 应用链接
const applyLink = () => {
  if (linkUrl.value.trim()) {
    props.onAction('link', { href: linkUrl.value.trim() });
  }
  showLinkInput.value = false;
  linkUrl.value = '';
};

// 移除链接
const removeLink = () => {
  props.onAction('unlink');
  showLinkInput.value = false;
  linkUrl.value = '';
};

// 取消链接输入
const cancelLink = () => {
  showLinkInput.value = false;
  linkUrl.value = '';
};

// 暴露更新方法给插件调用
defineExpose({
  update(show: boolean, left: number, top: number, marks: any, linkHref?: string) {
    visible.value = show;
    pos.left = left;
    pos.top = top;
    Object.assign(activeMarks, marks);
    
    // 如果已有链接，填充 URL
    if (linkHref) {
      linkUrl.value = linkHref;
    }
    
    // 关闭链接输入区（除非正在编辑链接）
    if (!marks.link) {
      showLinkInput.value = false;
      linkUrl.value = '';
    }
  }
});
</script>