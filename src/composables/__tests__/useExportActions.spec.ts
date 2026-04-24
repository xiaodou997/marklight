import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { createMarkdownCompatSchema } from '../../components/Editor/tiptap/markdown/compat-schema';
import { parseMarkdown } from '../../components/Editor/tiptap/markdown/parser';
import { useExportActions } from '../useExportActions';

const mocks = vi.hoisted(() => ({
  saveMock: vi.fn(),
  messageMock: vi.fn(),
  saveTextDocumentMock: vi.fn(),
  writeHtmlMock: vi.fn(),
  printCurrentDocumentMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: mocks.saveMock,
  message: mocks.messageMock,
}));

vi.mock('../../services/tauri/file-system', () => ({
  saveTextDocument: mocks.saveTextDocumentMock,
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeHtml: mocks.writeHtmlMock,
}));

vi.mock('../../services/tauri/window', () => ({
  printCurrentDocument: mocks.printCurrentDocumentMock,
}));

function createDoc(markdown: string) {
  return parseMarkdown(createMarkdownCompatSchema(), markdown);
}

function createWechatDoc() {
  const schema = createMarkdownCompatSchema();

  return schema.nodes.doc.create(null, [
    schema.nodes.callout.create({ type: 'tip', title: 'Copy me' }, [
      schema.nodes.paragraph.create(null, [
        schema.nodes.wikilink.create({ target: 'Wiki', alias: '' }),
      ]),
    ]),
  ]);
}

describe('useExportActions', () => {
  beforeEach(() => {
    mocks.saveMock.mockReset();
    mocks.messageMock.mockReset();
    mocks.saveTextDocumentMock.mockReset();
    mocks.writeHtmlMock.mockReset();
    mocks.printCurrentDocumentMock.mockReset();
  });

  it('exports full html documents through the doc-based renderer', async () => {
    mocks.saveMock.mockResolvedValue('/tmp/export.html');
    mocks.saveTextDocumentMock.mockResolvedValue(undefined);

    const doc = createDoc('---\ntitle: Doc Export\n---\n\n# Heading\n');
    const editorRef = ref({
      getDoc: () => doc,
      getContent: () => '# stale markdown\n',
    });

    const { exportHtml } = useExportActions({
      editorRef,
      activeViewMode: ref<'editor' | 'image'>('editor'),
      fileStore: {
        currentFile: {
          path: '/tmp/example.md',
          content: '# old content\n',
        },
      },
      settingsStore: {
        settings: {
          wechatTheme: 'blue',
        },
      },
    });

    await exportHtml();

    expect(mocks.saveMock).toHaveBeenCalled();
    expect(mocks.saveTextDocumentMock).toHaveBeenCalledTimes(1);
    expect(mocks.saveTextDocumentMock.mock.calls[0][0]).toBe('/tmp/export.html');
    expect(mocks.saveTextDocumentMock.mock.calls[0][1]).toContain('<!doctype html>');
    expect(mocks.saveTextDocumentMock.mock.calls[0][1]).toContain('<title>Doc Export</title>');
    expect(mocks.saveTextDocumentMock.mock.calls[0][1]).toContain('Heading');
  });

  it('copies wechat fragments instead of full documents', async () => {
    mocks.writeHtmlMock.mockResolvedValue(undefined);
    mocks.messageMock.mockResolvedValue(undefined);

    const doc = createWechatDoc();
    const editorRef = ref({
      getDoc: () => doc,
      getContent: () => 'fallback text',
    });

    const { copyToWechat } = useExportActions({
      editorRef,
      activeViewMode: ref<'editor' | 'image'>('editor'),
      fileStore: {
        currentFile: {
          path: '/tmp/example.md',
          content: 'fallback text',
        },
      },
      settingsStore: {
        settings: {
          wechatTheme: 'green',
        },
      },
    });

    await copyToWechat();

    expect(mocks.writeHtmlMock).toHaveBeenCalledTimes(1);
    expect(mocks.writeHtmlMock.mock.calls[0][0]).not.toContain('<!doctype html>');
    expect(mocks.writeHtmlMock.mock.calls[0][0]).toContain('data-wikilink="Wiki"');
    expect(mocks.writeHtmlMock.mock.calls[0][1]).toContain('Copy me');
    expect(mocks.messageMock).toHaveBeenCalledWith('已转换并复制到剪贴板', {
      title: '完成',
      kind: 'info',
    });
  });
});
