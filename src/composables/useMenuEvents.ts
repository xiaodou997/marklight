import { onMounted, onUnmounted } from 'vue';
import { listen } from '@tauri-apps/api/event';

export function useMenuEvents(onCommand: (commandId: string) => void | Promise<void>) {
  let unlistenMenu: (() => void) | null = null;

  onMounted(async () => {
    unlistenMenu = await listen('menu-event', (event) => {
      const commandId = event.payload as string;
      void onCommand(commandId);
    });
  });

  onUnmounted(() => {
    unlistenMenu?.();
    unlistenMenu = null;
  });
}
