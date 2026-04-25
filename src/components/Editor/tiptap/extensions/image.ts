/**
 * 图片扩展
 *
 * 支持本地路径、网络 URL、data URI。
 * Tauri 环境下的 asset:// 协议路径会自动转换。
 */
import Image from '@tiptap/extension-image';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface ImageMarkdownAttrs {
  src: string;
  alt: string;
  title: string | null;
}

export function formatImageMarkdown(attrs: ImageMarkdownAttrs): string {
  const alt = attrs.alt || '';
  const src = attrs.src || '';
  const title = attrs.title?.replace(/"/g, '\\"') ?? '';

  if (title) {
    return `![${alt}](${src} "${title}")`;
  }

  return `![${alt}](${src})`;
}

export function parseImageMarkdown(markdown: string): ImageMarkdownAttrs | null {
  const value = markdown.trim();
  const match = value.match(/^!\[(?<alt>[^\]]*)\]\((?<body>.*)\)$/);

  if (!match?.groups) {
    return null;
  }

  const alt = match.groups.alt ?? '';
  const body = match.groups.body.trim();
  const titleMatch = body.match(/^(?<src>.+?)(?:\s+"(?<title>(?:[^"\\]|\\.)*)")?$/);

  if (!titleMatch?.groups?.src) {
    return null;
  }

  const src = titleMatch.groups.src.trim();
  if (!src) {
    return null;
  }

  return {
    src,
    alt,
    title: titleMatch.groups.title == null ? null : titleMatch.groups.title.replace(/\\"/g, '"'),
  };
}

type RemoteImageFetcher = (src: string) => Promise<string>;
type RemoteImageCacheEntry =
  | { status: 'fulfilled'; value: string }
  | { status: 'pending'; promise: Promise<string> }
  | { status: 'failed'; expiresAt: number };

const MAX_REMOTE_IMAGE_CACHE_ENTRIES = 100;
const MAX_CONCURRENT_REMOTE_IMAGE_FETCHES = 4;
const REMOTE_IMAGE_FAILURE_TTL_MS = 5 * 60 * 1000;
const remoteImageCache = new Map<string, RemoteImageCacheEntry>();
const remoteImageQueue: Array<() => void> = [];

let activeRemoteImageFetches = 0;
let remoteImageFetcher: RemoteImageFetcher | null = null;

function isRemoteImageSrc(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

function touchRemoteImageCacheEntry(src: string, entry: RemoteImageCacheEntry) {
  remoteImageCache.delete(src);
  remoteImageCache.set(src, entry);
}

function trimRemoteImageCache() {
  while (remoteImageCache.size > MAX_REMOTE_IMAGE_CACHE_ENTRIES) {
    let removableKey: string | null = null;
    for (const [src, entry] of remoteImageCache) {
      if (entry.status !== 'pending') {
        removableKey = src;
        break;
      }
    }

    if (!removableKey) {
      break;
    }
    remoteImageCache.delete(removableKey);
  }
}

function runWithRemoteImageConcurrency<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeRemoteImageFetches += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeRemoteImageFetches -= 1;
          remoteImageQueue.shift()?.();
        });
    };

    if (activeRemoteImageFetches < MAX_CONCURRENT_REMOTE_IMAGE_FETCHES) {
      run();
    } else {
      remoteImageQueue.push(run);
    }
  });
}

function getRemoteImageFetcher(): RemoteImageFetcher {
  remoteImageFetcher ??= async (src: string) => {
    const { fetchRemoteImageData } = await import('../../../../services/tauri/document');
    return fetchRemoteImageData(src);
  };
  return remoteImageFetcher;
}

export async function getRemoteImageDisplaySrc(src: string): Promise<string> {
  if (!isRemoteImageSrc(src)) {
    return src;
  }

  const now = Date.now();
  const cached = remoteImageCache.get(src);
  if (cached) {
    if (cached.status === 'fulfilled') {
      touchRemoteImageCacheEntry(src, cached);
      return cached.value;
    }
    if (cached.status === 'pending') {
      touchRemoteImageCacheEntry(src, cached);
      return cached.promise;
    }
    if (cached.expiresAt > now) {
      touchRemoteImageCacheEntry(src, cached);
      return src;
    }
    remoteImageCache.delete(src);
  }

  const promise = runWithRemoteImageConcurrency(() => getRemoteImageFetcher()(src))
    .then((displaySrc) => {
      touchRemoteImageCacheEntry(src, { status: 'fulfilled', value: displaySrc });
      trimRemoteImageCache();
      return displaySrc;
    })
    .catch(() => {
      touchRemoteImageCacheEntry(src, {
        status: 'failed',
        expiresAt: Date.now() + REMOTE_IMAGE_FAILURE_TTL_MS,
      });
      trimRemoteImageCache();
      return src;
    });

  remoteImageCache.set(src, { status: 'pending', promise });
  trimRemoteImageCache();
  return promise;
}

export function __setRemoteImageFetcherForTests(fetcher: RemoteImageFetcher | null) {
  remoteImageFetcher = fetcher;
}

export function __resetRemoteImageCacheForTests() {
  remoteImageCache.clear();
  remoteImageQueue.splice(0, remoteImageQueue.length);
  activeRemoteImageFetches = 0;
  remoteImageFetcher = null;
}

export const CustomImage = Image.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span');
      dom.className = 'mk-image-shell';
      dom.draggable = false;

      const image = document.createElement('img');
      image.className = 'mk-image';
      image.loading = 'lazy';
      image.draggable = false;
      dom.appendChild(image);

      const sourceText = document.createElement('div');
      sourceText.className = 'mk-image-source-text';
      sourceText.contentEditable = 'plaintext-only';
      sourceText.spellcheck = false;
      sourceText.draggable = false;
      dom.appendChild(sourceText);

      let isEditing = false;

      const getAttrs = (): ImageMarkdownAttrs => ({
        src: (node.attrs.src as string) || '',
        alt: (node.attrs.alt as string) || '',
        title: (node.attrs.title as string | null) ?? null,
      });

      let displayRequestId = 0;
      let displaySrc = '';

      function syncView() {
        const attrs = getAttrs();
        const fallbackSrc = attrs.src;

        if (displaySrc !== fallbackSrc) {
          displaySrc = fallbackSrc;
          image.src = fallbackSrc;
        }

        image.alt = attrs.alt;
        image.title = attrs.title ?? '';

        if (isRemoteImageSrc(attrs.src)) {
          const requestId = ++displayRequestId;
          void getRemoteImageDisplaySrc(attrs.src).then((displaySrc) => {
            if (requestId === displayRequestId) {
              if (image.src !== displaySrc) {
                image.src = displaySrc;
              }
            }
          });
        }

        if (!isEditing) {
          sourceText.textContent = formatImageMarkdown(attrs);
        }
      }

      function commit() {
        const parsed = parseImageMarkdown(sourceText.textContent || '');
        if (!parsed) {
          dom.classList.add('is-invalid');
          requestAnimationFrame(() => {
            sourceText.focus();
          });
          return;
        }

        dom.classList.remove('is-invalid');
        isEditing = false;
        dom.classList.remove('is-editing');

        const current = getAttrs();
        if (
          parsed.src === current.src
          && parsed.alt === current.alt
          && parsed.title === current.title
        ) {
          syncView();
          return;
        }

        if (typeof getPos !== 'function') {
          syncView();
          return;
        }

        const pos = getPos();
        if (typeof pos !== 'number') {
          syncView();
          return;
        }
        const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          ...parsed,
        });
        editor.view.dispatch(tr);
      }

      function cancel() {
        isEditing = false;
        dom.classList.remove('is-editing');
        dom.classList.remove('is-invalid');
        syncView();
      }

      dom.addEventListener('dragstart', (event) => {
        event.preventDefault();
      });

      sourceText.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });

      sourceText.addEventListener('focus', () => {
        isEditing = true;
        dom.classList.add('is-editing');
        dom.classList.remove('is-invalid');
      });

      sourceText.addEventListener('blur', () => {
        commit();
      });

      sourceText.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          commit();
          editor.commands.focus();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
          editor.commands.focus();
        }
      });

      syncView();

      return {
        dom,
        update(updatedNode: PMNode) {
          if (updatedNode.type.name !== 'image') {
            return false;
          }

          node = updatedNode;
          syncView();
          return true;
        },
        stopEvent(event: Event) {
          return event.target instanceof Node && sourceText.contains(event.target);
        },
        ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }) {
          return (
            mutation.target instanceof Node
            && (
              mutation.target === dom
              || sourceText.contains(mutation.target)
              || image.contains(mutation.target)
            )
          );
        },
      };
    };
  },
}).configure({
  inline: true,
  allowBase64: true,
  HTMLAttributes: {
    class: 'mk-image',
    loading: 'lazy',
  },
});
