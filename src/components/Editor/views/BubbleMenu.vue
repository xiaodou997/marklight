<template>
  <div 
    v-show="visible"
    ref="menuRef"
    class="fixed z-50 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-xl transition-all duration-200"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px`, transform: 'translate(-50%, -120%)' }"
  >
    <button @click="exec('bold')" :class="btnClass(activeMarks.bold)" title="加粗">
      <span class="font-bold text-lg">B</span>
    </button>
    <button @click="exec('italic')" :class="btnClass(activeMarks.italic)" title="斜体">
      <span class="italic text-lg">I</span>
    </button>
    <button @click="exec('code')" :class="btnClass(activeMarks.code)" title="行内代码">
      <span class="font-mono text-sm">&lt;/&gt;</span>
    </button>
    <div class="mx-1 h-4 w-px bg-gray-200"></div>
    <button @click="exec('h1')" class="px-2 py-1 text-xs hover:bg-gray-100 rounded">H1</button>
    <button @click="exec('h2')" class="px-2 py-1 text-xs hover:bg-gray-100 rounded">H2</button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const props = defineProps<{
  onAction: (type: string) => void;
}>();

const visible = ref(false);
const pos = reactive({ left: 0, top: 0 });
const activeMarks = reactive({
  bold: false,
  italic: false,
  code: false
});

const btnClass = (active: boolean) => [
  'flex h-8 w-8 items-center justify-center rounded transition-colors',
  active ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
];

const exec = (type: string) => {
  props.onAction(type);
};

// 暴露更新方法给插件调用
defineExpose({
  update(show: boolean, left: number, top: number, marks: any) {
    visible.value = show;
    pos.left = left;
    pos.top = top;
    Object.assign(activeMarks, marks);
  }
});
</script>
