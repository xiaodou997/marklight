<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

export interface SidebarRenameDialogState {
  visible: boolean;
  newName: string;
}

export interface SidebarNewDialogState {
  visible: boolean;
  name: string;
  isFolder: boolean;
}

const props = defineProps<{
  renameDialog: SidebarRenameDialogState;
  newDialog: SidebarNewDialogState;
}>();

const emit = defineEmits<{
  (e: 'close-rename'): void;
  (e: 'update-rename-name', name: string): void;
  (e: 'confirm-rename'): void;
  (e: 'close-new'): void;
  (e: 'update-new-name', name: string): void;
  (e: 'confirm-new'): void;
}>();

const renameInputRef = ref<HTMLInputElement | null>(null);
const newInputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.renameDialog.visible,
  async (visible) => {
    if (!visible) return;
    await nextTick();
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  },
);

watch(
  () => props.newDialog.visible,
  async (visible) => {
    if (!visible) return;
    await nextTick();
    newInputRef.value?.focus();
  },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="renameDialog.visible" class="dialog-overlay" @click.self="emit('close-rename')">
      <div class="dialog">
        <div class="dialog-title">重命名</div>
        <input
          ref="renameInputRef"
          :value="renameDialog.newName"
          type="text"
          class="dialog-input"
          @input="emit('update-rename-name', ($event.target as HTMLInputElement).value)"
          @keydown.enter="emit('confirm-rename')"
          @keydown.esc="emit('close-rename')"
        />
        <div class="dialog-buttons">
          <button class="dialog-btn dialog-btn-cancel" @click="emit('close-rename')">
            取消
          </button>
          <button class="dialog-btn dialog-btn-confirm" @click="emit('confirm-rename')">
            确定
          </button>
        </div>
      </div>
    </div>

    <div v-if="newDialog.visible" class="dialog-overlay" @click.self="emit('close-new')">
      <div class="dialog">
        <div class="dialog-title">{{ newDialog.isFolder ? '新建文件夹' : '新建文件' }}</div>
        <input
          ref="newInputRef"
          :value="newDialog.name"
          type="text"
          class="dialog-input"
          :placeholder="newDialog.isFolder ? '文件夹名称' : '文件名 (如: note.md)'"
          @input="emit('update-new-name', ($event.target as HTMLInputElement).value)"
          @keydown.enter="emit('confirm-new')"
          @keydown.esc="emit('close-new')"
        />
        <div class="dialog-buttons">
          <button class="dialog-btn dialog-btn-cancel" @click="emit('close-new')">
            取消
          </button>
          <button class="dialog-btn dialog-btn-confirm" @click="emit('confirm-new')">
            确定
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  min-width: 300px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.dialog-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--sidebar-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.dialog-input:focus {
  border-color: var(--primary-color);
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.dialog-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.dialog-btn-cancel {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-color);
  opacity: 0.8;
}

.dark .dialog-btn-cancel {
  background: rgba(255, 255, 255, 0.1);
}

.dialog-btn-cancel:hover {
  opacity: 1;
}

.dialog-btn-confirm {
  background: var(--primary-color);
  color: white;
}

.dialog-btn-confirm:hover {
  filter: brightness(1.1);
}
</style>
