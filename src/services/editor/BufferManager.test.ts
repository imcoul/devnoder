import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  activeProjectId: { get: vi.fn(() => 'project-1') },
}));

vi.mock('../git/GitService', () => ({
  $activeProjectId: mocks.activeProjectId,
  normalizeProjectPath: (path: string) => path,
  writeFile: mocks.writeFile,
}));

vi.mock('../ai/EmbeddingEngine', () => ({
  embeddingEngine: { scheduleIndex: vi.fn() },
}));

import { $activeBuffer, $buffers, bufferManager } from './BufferManager';

describe('BufferManager durable editor lifecycle', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.writeFile.mockResolvedValue(undefined);
    $buffers.set([]);
    $activeBuffer.set(null);
  });

  it('autosaves an edit and only marks it clean after the write succeeds', async () => {
    vi.useFakeTimers();
    const id = bufferManager.open('src/main.js', '');
    bufferManager.update(id, 'console.log("saved")');
    await vi.advanceTimersByTimeAsync(400);

    expect(mocks.writeFile).toHaveBeenCalledWith('src/main.js', 'console.log("saved")');
    expect($buffers.get()[0]).toMatchObject({ dirty: false, saving: false, saveError: undefined });
  });

  it('persists edits made while an earlier write is in flight', async () => {
    let finishFirstWrite!: () => void;
    mocks.writeFile
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishFirstWrite = resolve; }))
      .mockResolvedValueOnce(undefined);

    const id = bufferManager.open('src/main.js', '');
    bufferManager.update(id, 'first');
    const saving = bufferManager.save(id);
    await Promise.resolve();
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);

    bufferManager.update(id, 'second');
    finishFirstWrite();
    await saving;

    expect(mocks.writeFile.mock.calls.map(([path, content]) => [path, content])).toEqual([
      ['src/main.js', 'first'],
      ['src/main.js', 'second'],
    ]);
    expect($buffers.get()[0]).toMatchObject({ content: 'second', dirty: false });
  });

  it('keeps a failed file dirty and exposes the storage error', async () => {
    mocks.writeFile.mockRejectedValueOnce(new Error('Storage quota exceeded'));
    const id = bufferManager.open('src/main.js', '');
    bufferManager.update(id, 'unsaved');

    await expect(bufferManager.save(id)).rejects.toThrow('Storage quota exceeded');
    expect($buffers.get()[0]).toMatchObject({ dirty: true, saving: false, saveError: 'Storage quota exceeded' });
  });

  it('flushes a dirty buffer before closing it or switching projects', async () => {
    const id = bufferManager.open('src/main.js', '');
    bufferManager.update(id, 'keep this');

    await bufferManager.closeAllBuffers();

    expect(mocks.writeFile).toHaveBeenCalledWith('src/main.js', 'keep this');
    expect($buffers.get()).toEqual([]);
    expect($activeBuffer.get()).toBeNull();
  });

  it('prevents a buffer from writing into a different active project', async () => {
    const id = bufferManager.open('src/main.js', '');
    bufferManager.update(id, 'project 1');
    mocks.activeProjectId.get.mockReturnValue('project-2');

    await expect(bufferManager.save(id)).rejects.toThrow('project is no longer active');
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect($buffers.get()[0].dirty).toBe(true);
  });

  it('replaces an existing clean or confirmed buffer after an external file write', () => {
    const id = bufferManager.open('src/main.js', 'old');
    bufferManager.replaceSaved('src/main.js', 'updated by AI');

    expect($activeBuffer.get()).toBe(id);
    expect($buffers.get()[0]).toMatchObject({ content: 'updated by AI', dirty: false });
  });
});
