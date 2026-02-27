<template>
  <div
    class="mermaid-view-wrapper"
    :class="{ 'is-editing': isEditing }"
    @click.stop="startEditing"
  >
    <!-- 渲染模式 -->
    <div v-show="!isEditing" class="mermaid-render-area">
      <div
        v-show="!isError"
        ref="containerRef"
        class="mermaid-container"
      ></div>

      <div v-if="isError" class="mermaid-error">
        <p class="font-bold mb-1">Mermaid 语法错误:</p>
        <pre class="whitespace-pre-wrap">{{ errorMessage }}</pre>
      </div>

      <div v-if="!isError" class="mermaid-badge">
        <span>Mermaid 图表</span>
      </div>
    </div>

    <!-- 编辑模式：显示源码 -->
    <div v-if="isEditing" class="mermaid-source" @click.stop>
      <div class="mermaid-source-header">
        <span class="mermaid-source-lang">```{{ lang }}</span>
        <button class="mermaid-source-done" @click.stop="stopEditing">完成</button>
      </div>
      <textarea
        ref="inputRef"
        v-model="sourceCode"
        class="mermaid-source-input"
        spellcheck="false"
        @blur="onBlur"
        @keydown.esc="stopEditing"
        @input="autoResize"
      ></textarea>
      <span class="mermaid-source-lang">```</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
});

const props = defineProps<{
  node: any;
  updateContent: (text: string) => void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const isError = ref(false);
const errorMessage = ref('');
const isEditing = ref(false);
const sourceCode = ref('');

const lang = computed(() => props.node.attrs?.params || 'mermaid');

/**
 * 将 flowchart.js 语法转换为 mermaid flowchart 语法
 */
function convertFlowToMermaid(raw: string): string {
  const lines = raw.trim().split('\n');
  const nodes: Record<string, { type: string; text: string }> = {};
  const connections: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const nodeDef = trimmed.match(/^(\w+)=>(\w+):\s*(.*)$/);
    if (nodeDef) {
      nodes[nodeDef[1]] = { type: nodeDef[2], text: nodeDef[3] };
      continue;
    }

    const parts = trimmed.split('->');
    for (let i = 0; i < parts.length - 1; i++) {
      const fromMatch = parts[i].match(/^(\w+)(?:\(([^)]*)\))?$/);
      const toMatch = parts[i + 1].match(/^(\w+)(?:\(([^)]*)\))?$/);
      if (fromMatch && toMatch) {
        const label = fromMatch[2] || '';
        connections.push(label ? `    ${fromMatch[1]} -->|${label}| ${toMatch[1]}` : `    ${fromMatch[1]} --> ${toMatch[1]}`);
      }
    }
  }

  const shapeMap: Record<string, (id: string, t: string) => string> = {
    start: (id, t) => `    ${id}([${t}])`,
    end: (id, t) => `    ${id}([${t || 'End'}])`,
    operation: (id, t) => `    ${id}[${t}]`,
    condition: (id, t) => `    ${id}{${t}}`,
    subroutine: (id, t) => `    ${id}[[${t}]]`,
    inputoutput: (id, t) => `    ${id}[/${t}/]`,
  };

  const nodeLines = Object.entries(nodes).map(([id, { type, text }]) => {
    const fn = shapeMap[type] || shapeMap.operation;
    return fn(id, text);
  });

  return `flowchart TD\n${nodeLines.join('\n')}\n${connections.join('\n')}`;
}

/**
 * 将 js-sequence-diagrams 语法转换为 mermaid sequenceDiagram 语法
 */
function convertSeqToMermaid(raw: string): string {
  const lines = raw.trim().split('\n').map(l => {
    const trimmed = l.trim();
    if (!trimmed) return '';
    if (/^Note\s/i.test(trimmed)) return `    ${trimmed}`;
    return '    ' + trimmed.replace(/-->/g, '\x00').replace(/->/g, '->>').replace(/\x00/g, '-->>');
  });
  return `sequenceDiagram\n${lines.join('\n')}`;
}

const renderChart = async () => {
  if (!containerRef.value) return;

  const rawCode = props.node.textContent;
  if (!rawCode || !rawCode.trim()) {
    containerRef.value.innerHTML = '<div class="text-gray-300 italic">空图表</div>';
    return;
  }

  let code = rawCode;
  const l = lang.value;

  if (l === 'flow') {
    code = convertFlowToMermaid(rawCode);
  } else if (l === 'seq') {
    code = convertSeqToMermaid(rawCode);
  } else if (l && l !== 'mermaid' && !rawCode.trimStart().startsWith(l)) {
    code = l + '\n' + rawCode;
  }

  try {
    isError.value = false;
    const id = `mermaid-render-${Math.random().toString(36).substring(2, 11)}`;
    const { svg } = await mermaid.render(id, code);
    containerRef.value.innerHTML = svg;
  } catch (e: any) {
    isError.value = true;
    errorMessage.value = e.message || '渲染失败，请检查语法';
    console.warn('Mermaid rendering error:', e);
  }
};

const autoResize = () => {
  const el = inputRef.value;
  if (el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
};

const startEditing = () => {
  sourceCode.value = props.node.textContent || '';
  isEditing.value = true;
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      autoResize();
    }
  });
};

const stopEditing = () => {
  if (!isEditing.value) return;
  // 将编辑内容写回节点
  const newText = sourceCode.value;
  const oldText = props.node.textContent || '';
  if (newText !== oldText) {
    props.updateContent(newText);
  }
  isEditing.value = false;
  nextTick(renderChart);
};

// blur 时延迟一点，避免点击"完成"按钮时先触发 blur 导致按钮消失
const onBlur = () => {
  setTimeout(stopEditing, 150);
};

onMounted(renderChart);
watch(() => props.node.textContent, () => {
  if (!isEditing.value) {
    renderChart();
  }
});
</script>

<style scoped>
.mermaid-view-wrapper {
  margin: 1.5em 0;
  position: relative;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  padding: 0.5em;
  transition: all 0.15s ease;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: pointer;
}
.mermaid-view-wrapper:hover {
  border-color: #bfdbfe;
}
.mermaid-view-wrapper.is-editing {
  border-color: #93c5fd;
  background: #f8fafc;
  cursor: default;
}

.mermaid-container {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding: 1em 0;
  min-height: 60px;
}

.mermaid-error {
  background: #fef2f2;
  color: #ef4444;
  padding: 1em;
  border-radius: 0.25em;
  font-size: 0.75rem;
  font-family: ui-monospace, monospace;
  border: 1px solid #fecaca;
}

.mermaid-badge {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  opacity: 0;
  transition: opacity 0.15s;
}
.mermaid-view-wrapper:hover .mermaid-badge {
  opacity: 1;
}
.mermaid-badge span {
  font-size: 10px;
  background: #f3f4f6;
  color: #9ca3af;
  padding: 2px 8px;
  border-radius: 4px;
}

/* 编辑模式 - 源码区 */
.mermaid-source {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

.mermaid-source-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25em;
}

.mermaid-source-lang {
  color: #a78bfa;
  font-weight: 600;
  user-select: none;
}

.mermaid-source-done {
  font-size: 0.75rem;
  padding: 2px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.mermaid-source-done:hover {
  background: #2563eb;
}

.mermaid-source-input {
  display: block;
  width: 100%;
  min-height: 4em;
  padding: 0.5em;
  margin: 0.25em 0;
  background: #1e293b;
  color: #e2e8f0;
  border: none;
  border-radius: 6px;
  outline: none;
  resize: none;
  overflow: hidden;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
</style>
