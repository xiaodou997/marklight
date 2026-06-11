<script setup lang="ts">
defineProps<{
  visible: boolean;
  imageUrl: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 cursor-zoom-out"
        @click="emit('close')"
      >
        <img :src="imageUrl" class="max-w-full max-h-full object-contain" @click.stop />
        <button
          class="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          @click="emit('close')"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
