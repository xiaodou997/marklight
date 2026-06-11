import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TAURI_COMMANDS } from '../command-names';

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  invokeCommand: invokeCommandMock,
}));

describe('tauri workspace service', () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it('lists workspace entries through the typed command wrapper', async () => {
    const entries = [
      {
        name: 'demo.md',
        path: '/tmp/demo.md',
        kind: 'markdown',
      },
    ];
    invokeCommandMock.mockResolvedValueOnce(entries);

    const { listWorkspaceEntries } = await import('../workspace');

    await expect(listWorkspaceEntries('/tmp')).resolves.toBe(entries);
    expect(invokeCommandMock).toHaveBeenCalledWith(TAURI_COMMANDS.listWorkspaceEntries, {
      rootPath: '/tmp',
    });
  });

  it('routes workspace entry mutations through native commands', async () => {
    const { createWorkspaceEntry, renameWorkspaceEntry, trashWorkspaceEntry } = await import(
      '../workspace'
    );

    await createWorkspaceEntry('/tmp', 'file', 'demo.md');
    await renameWorkspaceEntry('/tmp/demo.md', 'notes.md');
    await trashWorkspaceEntry('/tmp/notes.md');

    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      1,
      TAURI_COMMANDS.createWorkspaceEntry,
      {
        parentPath: '/tmp',
        kind: 'file',
        name: 'demo.md',
      },
    );
    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      2,
      TAURI_COMMANDS.renameWorkspaceEntry,
      {
        path: '/tmp/demo.md',
        newName: 'notes.md',
      },
    );
    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      3,
      TAURI_COMMANDS.trashWorkspaceEntry,
      {
        path: '/tmp/notes.md',
      },
    );
  });

  it('routes watcher lifecycle through native commands', async () => {
    const { unwatchWorkspace, watchWorkspace } = await import('../workspace');

    await watchWorkspace('/tmp/project');
    await unwatchWorkspace('/tmp/project');

    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      1,
      TAURI_COMMANDS.watchWorkspace,
      {
        rootPath: '/tmp/project',
      },
    );
    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      2,
      TAURI_COMMANDS.unwatchWorkspace,
      {
        rootPath: '/tmp/project',
      },
    );
  });

  it('reveals entries through the platform reveal command', async () => {
    const { revealWorkspaceEntry } = await import('../workspace');

    await revealWorkspaceEntry('/tmp/demo.md');

    expect(invokeCommandMock).toHaveBeenCalledWith(TAURI_COMMANDS.revealInFinder, {
      path: '/tmp/demo.md',
    });
  });
});
