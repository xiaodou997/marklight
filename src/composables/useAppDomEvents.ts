import type { Ref } from 'vue';
import { onMounted, onUnmounted } from 'vue';
import type { CommandDefinition } from '../commands/registry';

export interface AppDomEditorApi {
  getEditorView?: () => { hasFocus: () => boolean } | null;
  getSelectionMarkdown?: () => string;
}

export interface AppDomEventsOptions {
  editorRef: Ref<AppDomEditorApi | null>;
  activeViewMode: Ref<'editor' | 'image'>;
  isSourceMode: Ref<boolean>;
  isFullscreenPreview: Ref<boolean>;
  isFocusMode: () => boolean;
  customShortcuts: () => Record<string, string>;
  findCommandByShortcut: (
    event: KeyboardEvent,
    customShortcuts: Record<string, string>,
  ) => CommandDefinition | undefined;
  executeCommand: (commandId: string, source: 'shortcut') => Promise<boolean>;
  clearFullscreenPreview: () => void;
  toggleFocusMode: () => void | Promise<void>;
  showImagePasteWarning: (message: string) => void;
}

export function useAppDomEvents(options: AppDomEventsOptions) {
  function onCopy(event: ClipboardEvent) {
    if (
      !options.editorRef.value ||
      options.isSourceMode.value ||
      options.activeViewMode.value !== 'editor'
    ) {
      return;
    }

    const view = options.editorRef.value.getEditorView?.();
    if (!view || !view.hasFocus()) return;
    const markdown = options.editorRef.value.getSelectionMarkdown?.() || '';
    if (!markdown) return;
    event.clipboardData?.setData('text/plain', markdown);
    event.preventDefault();
  }

  const handleImagePasteWarning = (event: Event) => {
    const detail = (event as CustomEvent).detail as string | undefined;
    if (detail) {
      options.showImagePasteWarning(detail);
    }
  };

  async function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-shortcut-capture="true"]')) {
      return;
    }

    const command = options.findCommandByShortcut(event, options.customShortcuts());
    if (command) {
      if (
        target?.closest('.tiptap-editor') &&
        (command.id === 'editor.undo' || command.id === 'editor.redo')
      ) {
        return;
      }

      const handled = await options.executeCommand(command.id, 'shortcut');
      if (handled) {
        event.preventDefault();
        return;
      }
    }

    if (event.key === 'Escape') {
      if (options.isFullscreenPreview.value) {
        options.clearFullscreenPreview();
      } else if (options.isFocusMode()) {
        await options.toggleFocusMode();
      }
    }
  }

  onMounted(() => {
    document.addEventListener('copy', onCopy);
    window.addEventListener('image-paste-warning', handleImagePasteWarning as EventListener);
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('copy', onCopy);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('image-paste-warning', handleImagePasteWarning as EventListener);
  });

  return {
    handleKeyDown,
    onCopy,
  };
}
