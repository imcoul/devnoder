// BufferManager.ts — open files, dirty tracking, swipe navigation
import { atom } from 'nanostores';
import { $activeProjectId, normalizeProjectPath, writeFile } from '../git/GitService';

export interface Buffer {
  id: string;
  projectId: string;
  path: string;
  filename: string;
  content: string;
  language: string;
  dirty: boolean;
  saving: boolean;
  saveError?: string;
  cursorLine: number;
  cursorCol: number;
  scrollTop: number;
}

export const $buffers = atom<Buffer[]>([]);
export const $activeBuffer = atom<string | null>(null);

const SAVE_DELAY_MS = 400;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const saveVersions = new Map<string, number>();
const inFlightSaves = new Map<string, Promise<void>>();

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const m: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    html: 'html', css: 'css', json: 'json', md: 'markdown',
    py: 'python', rs: 'rust', cpp: 'cpp', c: 'c', sql: 'sql',
    yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'bash',
    dart: 'dart', php: 'php', rb: 'ruby', xml: 'xml',
  };
  return m[ext] ?? 'plaintext';
}

function updateBuffer(id: string, patch: Partial<Buffer>): void {
  $buffers.set($buffers.get().map(buffer =>
    buffer.id === id ? { ...buffer, ...patch } : buffer
  ));
}

function clearSaveTimer(id: string): void {
  const timer = saveTimers.get(id);
  if (timer) clearTimeout(timer);
  saveTimers.delete(id);
}

function scheduleSave(id: string): void {
  clearSaveTimer(id);
  saveTimers.set(id, setTimeout(() => {
    saveTimers.delete(id);
    void bufferManager.save(id).catch(() => {
      // The failure is kept on the buffer and displayed in the editor.
    });
  }, SAVE_DELAY_MS));
}

export const bufferManager = {
  open(path: string, content = '', language?: string): string {
    const safePath = normalizeProjectPath(path);
    const projectId = $activeProjectId.get();
    const existing = $buffers.get().find(b => b.projectId === projectId && b.path === safePath);
    if (existing) {
      if (!existing.dirty && existing.content !== content) {
        updateBuffer(existing.id, { content, saveError: undefined });
      }
      $activeBuffer.set(existing.id);
      return existing.id;
    }

    const id = crypto.randomUUID();
    const filename = safePath.split('/').pop() ?? safePath;
    const buf: Buffer = {
      id, projectId, path: safePath, filename, content,
      language: language ?? langFromPath(safePath),
      dirty: false, saving: false, cursorLine: 0, cursorCol: 0, scrollTop: 0,
    };
    $buffers.set([...$buffers.get(), buf]);
    $activeBuffer.set(id);
    return id;
  },

  update(id: string, content: string): void {
    const buffer = $buffers.get().find(b => b.id === id);
    if (!buffer || buffer.content === content) return;
    saveVersions.set(id, (saveVersions.get(id) ?? 0) + 1);
    updateBuffer(id, { content, dirty: true, saveError: undefined });
    scheduleSave(id);
    import('../ai/EmbeddingEngine')
      .then(m => m.embeddingEngine.scheduleIndex(buffer.path, content))
      .catch(() => { /* engine not ready */ });
  },

  /** Edits made during an in-flight write are persisted before this resolves. */
  async save(id: string): Promise<void> {
    clearSaveTimer(id);
    const pending = inFlightSaves.get(id);
    if (pending) return pending;

    const task = (async () => {
      while (true) {
        const buffer = $buffers.get().find(b => b.id === id);
        if (!buffer || !buffer.dirty) return;
        if (buffer.projectId !== $activeProjectId.get()) {
          throw new Error('Cannot save because this file’s project is no longer active. Reopen the project and retry.');
        }

        const version = saveVersions.get(id) ?? 0;
        const content = buffer.content;
        updateBuffer(id, { saving: true, saveError: undefined });
        await writeFile(buffer.path, content);

        const latest = $buffers.get().find(b => b.id === id);
        if (!latest) return;
        if (latest.projectId === buffer.projectId && latest.path === buffer.path
          && latest.content === content && (saveVersions.get(id) ?? 0) === version) {
          updateBuffer(id, { dirty: false, saving: false, saveError: undefined });
          return;
        }
        // A newer edit arrived during I/O; loop and save that value too.
      }
    })().catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      updateBuffer(id, { saving: false, dirty: true, saveError: message });
      throw error;
    }).finally(() => {
      inFlightSaves.delete(id);
    });

    inFlightSaves.set(id, task);
    return task;
  },

  async saveAll(): Promise<void> {
    const dirtyIds = $buffers.get().filter(b => b.dirty).map(b => b.id);
    await Promise.all(dirtyIds.map(id => this.save(id)));
  },

  /** Call only after an external file write has succeeded. */
  replaceSaved(path: string, content: string, language?: string): string {
    const safePath = normalizeProjectPath(path);
    const projectId = $activeProjectId.get();
    const existing = $buffers.get().find(b => b.projectId === projectId && b.path === safePath);
    if (!existing) return this.open(safePath, content, language);

    clearSaveTimer(existing.id);
    saveVersions.set(existing.id, (saveVersions.get(existing.id) ?? 0) + 1);
    updateBuffer(existing.id, {
      content, dirty: false, saving: false, saveError: undefined,
      language: language ?? existing.language,
    });
    $activeBuffer.set(existing.id);
    return existing.id;
  },

  async close(id: string): Promise<void> {
    const buffer = $buffers.get().find(b => b.id === id);
    if (buffer?.dirty) await this.save(id);
    clearSaveTimer(id);
    const list = $buffers.get().filter(b => b.id !== id);
    $buffers.set(list);
    if ($activeBuffer.get() === id) $activeBuffer.set(list[list.length - 1]?.id ?? null);
    saveVersions.delete(id);
  },

  /** Flush dirty files before changing projects, so a failed save cannot drop work. */
  async closeAllBuffers(): Promise<void> {
    await this.saveAll();
    for (const buffer of $buffers.get()) {
      clearSaveTimer(buffer.id);
      saveVersions.delete(buffer.id);
    }
    $buffers.set([]);
    $activeBuffer.set(null);
  },

  swipeNext(): void {
    const list = $buffers.get();
    if (list.length < 2) return;
    const idx = list.findIndex(b => b.id === $activeBuffer.get());
    $activeBuffer.set(list[(idx + 1) % list.length].id);
  },

  swipePrev(): void {
    const list = $buffers.get();
    if (list.length < 2) return;
    const idx = list.findIndex(b => b.id === $activeBuffer.get());
    $activeBuffer.set(list[(idx - 1 + list.length) % list.length].id);
  },

  saveCursor(id: string, line: number, col: number, scrollTop: number): void {
    updateBuffer(id, { cursorLine: line, cursorCol: col, scrollTop });
  },

  getActive(): Buffer | undefined {
    return $buffers.get().find(b => b.id === $activeBuffer.get());
  },
};
