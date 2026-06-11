import { onBeforeUnmount, onMounted, watch } from 'vue';

import { useSettingsStore } from '../../../stores/settings';

const customCssId = 'marklight-custom-editor-css';
const hljsDarkCssId = 'hljs-dark-theme';

function injectCustomCSS(css: string) {
  let el = document.getElementById(customCssId) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = customCssId;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function syncHljsTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  let el = document.getElementById(hljsDarkCssId) as HTMLLinkElement | null;
  if (isDark) {
    if (!el) {
      el = document.createElement('link');
      el.id = hljsDarkCssId;
      el.rel = 'stylesheet';
      el.href = new URL('highlight.js/styles/github-dark.css', import.meta.url).href;
      document.head.appendChild(el);
    }
  } else {
    el?.remove();
  }
}

export function useEditorAppearance() {
  const settingsStore = useSettingsStore();
  const themeObserver = new MutationObserver(syncHljsTheme);

  watch(() => settingsStore.settings.customEditorCSS, injectCustomCSS, { immediate: true });

  onMounted(() => {
    syncHljsTheme();
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  });

  onBeforeUnmount(() => {
    themeObserver.disconnect();
  });
}
