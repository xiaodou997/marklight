// @vitest-environment happy-dom
/**
 * IME / 输入编排路径的回归测试。
 *
 * markdown-input.spec.ts 只测纯转换函数（convert / revert 系列），不覆盖
 * composition 编排——而这正是最易回归处（重构期出现过「`# ` + 拼音上屏后
 * 中文掉到下一行」的 bug）。本文件锁住的是**编排不变量**，分两层：
 *
 *   1. 状态机层：把 markdownInputPlugin() 装进裸 EditorState，用 meta 事务模拟
 *      compositionstart/end 设置的插件状态、用 insert 事务模拟 IME 上屏文本，再
 *      state.apply 触发 appendTransaction。fake timers 控制 Date.now() 以覆盖
 *      suppressUntil 闸门。无头环境无法忠实复现 readDOMChange，但能锁死真正的
 *      防御契约：composition 期间绝不转换、settle 后才转换。
 *
 *   2. 真定时器层：起真实 EditorView，文本仍用事务喂（不依赖 readDOMChange），
 *      从而真正执行 view()/compositionend 里的 window.setTimeout 调度，用
 *      vi.advanceTimersByTime 推进定时器到点。
 */
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMarkdownCompatSchema } from '../../markdown/compat-schema';
import { markdownInputPlugin, markdownInputPluginKey } from '../markdown-input';

const schema = createMarkdownCompatSchema();

function paragraph(text?: string): PMNode {
  return schema.nodes.paragraph.create(null, text ? [schema.text(text)] : []);
}

function heading(level: number, text?: string): PMNode {
  return schema.nodes.heading.create({ level }, text ? [schema.text(text)] : []);
}

function docOf(...blocks: PMNode[]): PMNode {
  return schema.nodes.doc.create(null, blocks);
}

function stateWith(doc: PMNode, cursor: number): EditorState {
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, cursor),
    plugins: [markdownInputPlugin()],
  });
}

/** 构建并应用一个事务（state.apply 会顺带跑插件的 appendTransaction）。 */
function dispatch(state: EditorState, build: (tr: Transaction) => void): EditorState {
  const tr = state.tr;
  build(tr);
  return state.apply(tr);
}

// 下面三个 meta setter 镜像插件 handleDOMEvents / 定时器回调实际写入的状态。
function metaCompositionStart(tr: Transaction): Transaction {
  return tr.setMeta(markdownInputPluginKey, {
    composing: true,
    forceCheck: false,
    suppressUntil: Number.POSITIVE_INFINITY,
  });
}
function metaCompositionEnd(tr: Transaction, suppressUntil: number): Transaction {
  return tr.setMeta(markdownInputPluginKey, {
    composing: false,
    forceCheck: false,
    suppressUntil,
  });
}
/** 模拟 settle 定时器到点：强制扫描一次。 */
function metaForceCheck(tr: Transaction): Transaction {
  return tr.setMeta(markdownInputPluginKey, {
    composing: false,
    forceCheck: true,
    suppressUntil: 0,
  });
}

function markNames(doc: PMNode): Set<string> {
  const names = new Set<string>();
  doc.descendants((node) => {
    node.marks.forEach((mark) => names.add(mark.type.name));
  });
  return names;
}

describe('状态机层：composition 编排不变量', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a) `# ` + 中文 composition + 上屏：中文落标题，不另起段落，不残留拼音', () => {
    // 已输入 `# `，光标在末尾（pos 3）。
    let state = stateWith(docOf(paragraph('# ')), 3);

    // compositionstart：开始组字。
    state = dispatch(state, (tr) => metaCompositionStart(tr));

    // IME 组字上屏「你好」（仍在 composition：无独立 meta，沿用 composing=true）。
    state = dispatch(state, (tr) => tr.insertText('你好', state.selection.from));

    // 关键不变量：composition 期间绝不把 pending heading 转成真 heading。
    expect(state.doc.firstChild!.type.name).toBe('paragraph');
    expect(state.doc.firstChild!.textContent).toBe('# 你好');

    // compositionend：进入 50ms 抑制窗。
    state = dispatch(state, (tr) => metaCompositionEnd(tr, Date.now() + 50));
    // 抑制窗内仍不转。
    expect(state.doc.firstChild!.type.name).toBe('paragraph');

    // 50ms 定时器到点 → forceCheck，settle 后转换。
    vi.advanceTimersByTime(50);
    state = dispatch(state, (tr) => metaForceCheck(tr));

    // 单个 heading、内容=你好、无 `# ` 前缀、无第二个块（中文没掉到下一行）。
    expect(state.doc.childCount).toBe(1);
    const h = state.doc.firstChild!;
    expect(h.type.name).toBe('heading');
    expect(h.attrs.level).toBe(1);
    expect(h.textContent).toBe('你好');
  });

  it('(b) `**` + 中文 composition + `**`：settle 后转 bold', () => {
    // 已输入 `**`，光标在末尾（pos 3）。
    let state = stateWith(docOf(paragraph('**')), 3);

    state = dispatch(state, (tr) => metaCompositionStart(tr));
    state = dispatch(state, (tr) => tr.insertText('中文', state.selection.from));
    // composition 期间不转。
    expect(state.doc.firstChild!.textContent).toBe('**中文');
    expect(markNames(state.doc).has('bold')).toBe(false);

    state = dispatch(state, (tr) => metaCompositionEnd(tr, Date.now() + 50));
    // 关闭标记 `**` 由非 IME 输入补上（compositionend 之后、抑制窗内）。
    state = dispatch(state, (tr) => tr.insertText('**', state.selection.from));
    // 抑制窗内即便 docChanged 也不转。
    expect(markNames(state.doc).has('bold')).toBe(false);

    vi.advanceTimersByTime(50);
    state = dispatch(state, (tr) => metaForceCheck(tr));

    // `**中文**` → bold「中文」。
    expect(state.doc.firstChild!.textContent).toBe('中文');
    expect(markNames(state.doc).has('bold')).toBe(true);
  });

  it('(b2) `[` + 中文 composition + `](url)`：settle 后转 link mark', () => {
    // 已输入 `[`，光标在末尾（pos 2）。
    let state = stateWith(docOf(paragraph('[')), 2);

    state = dispatch(state, (tr) => metaCompositionStart(tr));
    state = dispatch(state, (tr) => tr.insertText('中文', state.selection.from));
    // composition 期间不转。
    expect(markNames(state.doc).has('link')).toBe(false);

    state = dispatch(state, (tr) => metaCompositionEnd(tr, Date.now() + 50));
    // 闭合 `](url)` 由非 IME 输入补上。
    state = dispatch(state, (tr) => tr.insertText('](https://a.com)', state.selection.from));
    // 抑制窗内不转。
    expect(markNames(state.doc).has('link')).toBe(false);

    vi.advanceTimersByTime(50);
    state = dispatch(state, (tr) => metaForceCheck(tr));

    // `[中文](https://a.com)` → link「中文」，href 正确。
    const text = state.doc.firstChild!.firstChild!;
    expect(text.textContent).toBe('中文');
    const linkMark = text.marks.find((m) => m.type.name === 'link');
    expect(linkMark?.attrs.href).toBe('https://a.com');
  });

  it('(c) 空标题 Backspace → 回退成 `# ` paragraph', () => {
    // heading(level 2) 含「X」，光标在 X 之后（pos 2）。
    let state = stateWith(docOf(heading(2, 'X')), 2);

    // Backspace 删掉 X → 空 heading。
    state = dispatch(state, (tr) => tr.delete(state.selection.from - 1, state.selection.from));

    const para = state.doc.firstChild!;
    expect(para.type.name).toBe('paragraph');
    expect(para.textContent).toBe('## ');
  });

  it('(d) 非 IME `# x`：settle 前不转，forceCheck 后转 heading', () => {
    let state = stateWith(docOf(paragraph()), 1);

    // 非 IME 直接输入 `# x`（无 composition）。
    state = dispatch(state, (tr) => tr.insertText('# x', 1));
    // settle 未到（仅 docChanged，forceCheck 未触发）→ 保持 pending paragraph。
    expect(state.doc.firstChild!.type.name).toBe('paragraph');
    expect(state.doc.firstChild!.textContent).toBe('# x');

    // 300ms 定时器到点 → forceCheck。
    vi.advanceTimersByTime(300);
    state = dispatch(state, (tr) => metaForceCheck(tr));

    expect(state.doc.firstChild!.type.name).toBe('heading');
    expect(state.doc.firstChild!.textContent).toBe('x');
  });
});

describe('真定时器层：真实 EditorView 执行 window.setTimeout', () => {
  let view: EditorView | null = null;
  let mount: HTMLElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });
  afterEach(() => {
    if (view && !view.isDestroyed) view.destroy();
    view = null;
    if (mount) mount.remove();
    mount = null;
    vi.useRealTimers();
  });

  function mountView(doc: PMNode, cursor: number): EditorView {
    const state = EditorState.create({
      schema,
      doc,
      selection: TextSelection.create(doc, cursor),
      plugins: [markdownInputPlugin()],
    });
    view = new EditorView(mount!, { state });
    return view;
  }

  it('(d-timer) 非 IME `# x`：view.update 调度的 300ms 定时器到点后转 heading', () => {
    const v = mountView(docOf(paragraph()), 1);

    v.dispatch(v.state.tr.insertText('# x', 1));
    // 定时器尚未到点 → 仍是 pending paragraph。
    expect(v.state.doc.firstChild!.type.name).toBe('paragraph');

    vi.advanceTimersByTime(300);
    // 真实定时器回调已 dispatch forceCheck → 转换完成。
    expect(v.state.doc.firstChild!.type.name).toBe('heading');
    expect(v.state.doc.firstChild!.textContent).toBe('x');
  });

  it('(a-timer) compositionend 后 50ms 定时器到点 → 强制扫描转换 heading', () => {
    const v = mountView(docOf(paragraph('# ')), 3);

    // 模拟 IME 文本上屏。
    v.dispatch(v.state.tr.insertText('你好', 3));
    expect(v.state.doc.firstChild!.type.name).toBe('paragraph');

    // 真实 compositionend DOM 事件 → 插件安排 50ms forceCheck 定时器。
    v.dom.dispatchEvent(new Event('compositionend'));
    vi.advanceTimersByTime(50);

    expect(v.state.doc.firstChild!.type.name).toBe('heading');
    expect(v.state.doc.firstChild!.textContent).toBe('你好');
  });
});
