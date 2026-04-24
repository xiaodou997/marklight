import { onMounted, onUnmounted } from 'vue';
import { listenMenuEvent } from '../services/tauri/events';

export function useMenuEvents(onCommand: (commandId: string) => void | Promise<void>) {
  let unlistenMenu: (() => void) | null = null;

  onMounted(async () => {
    unlistenMenu = await listenMenuEvent((commandId) => {
      void onCommand(commandId);
    });
  });

  onUnmounted(() => {
    unlistenMenu?.();
    unlistenMenu = null;
  });
}
