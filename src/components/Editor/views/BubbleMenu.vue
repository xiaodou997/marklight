<template>
  <div
    v-show="visible"
    ref="menuRef"
    class="bubble-menu"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px`, transform: 'translate(-50%, -120%)' }"
    @mousedown.prevent
    @click.stop
  >
    <!-- 主工具栏 -->
    <div class="bubble-menu-toolbar">
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
      <div class="bubble-menu-divider"></div>
      <button @click="exec('h1')" class="bubble-menu-heading-btn">H1</button>
      <button @click="exec('h2')" class="bubble-menu-heading-btn">H2</button>
    </div>

    <!-- 链接输入区 -->
    <div v-if="showLinkInput" class="bubble-menu-link-section">
      <input
        ref="linkInputRef"
        v-model="linkUrl"
        type="url"
        placeholder="输入链接地址..."
        class="bubble-menu-input"
        @keydown.enter="applyLink"
        @keydown.escape="cancelLink"
      />
      <button @click="applyLink" class="bubble-menu-btn-primary">
        确定
      </button>
      <button v-if="activeMarks.link" @click="removeLink" class="bubble-menu-btn-danger">
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
  'bubble-menu-btn',
  active ? 'bubble-menu-btn--active' : ''
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

<style scoped>
.bubble-menu {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 4px;
  background-color: var(--popover-bg);
  border: 1px solid var(--popover-border);
  border-radius: var(--radius-md);
  box-shadow: var(--popover-shadow);
  transition: all 0.2s;
}

.bubble-menu-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bubble-menu-btn {
  display: flex;
  height: 32px;
  width: 32px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-color);
  background-color: transparent;
  transition: background-color 0.15s;
  cursor: pointer;
  border: none;
}

.bubble-menu-btn:hover {
  background-color: var(--hover-bg);
}

.bubble-menu-btn--active {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.bubble-menu-divider {
  margin: 0 4px;
  height: 16px;
  width: 1px;
  background-color: var(--border-color);
}

.bubble-menu-heading-btn {
  padding: 4px 8px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--text-color);
  cursor: pointer;
  border: none;
  transition: background-color 0.15s;
}

.bubble-menu-heading-btn:hover {
  background-color: var(--hover-bg);
}

.bubble-menu-link-section {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: 4px;
}

.bubble-menu-input {
  width: 180px;
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-color);
  outline: none;
}

.bubble-menu-input:focus {
  border-color: var(--input-focus-border);
  box-shadow: var(--input-focus-shadow);
}

.bubble-menu-input::placeholder {
  color: var(--input-placeholder);
}

.bubble-menu-btn-primary {
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: none;
  transition: background-color 0.15s;
}

.bubble-menu-btn-primary:hover {
  background-color: var(--btn-primary-hover);
}

.bubble-menu-btn-danger {
  padding: 4px 8px;
  font-size: 12px;
  background-color: transparent;
  color: var(--error-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: none;
  transition: background-color 0.15s;
}

.bubble-menu-btn-danger:hover {
  background-color: var(--error-bg);
}
</style>