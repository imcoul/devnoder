// BufferManager.ts — open files, dirty tracking, swipe navigation
import { atom, map } from 'nanostores';

export interface Buffer {
  id: string;
  path: string;
  filename: string;
  content: string;
  language: string;
  dirty: boolean;
  cursorLine: number;
  cursorCol: number;
  scrollTop: number;
}

export const $buffers     = atom<Buffer[]>([]);
export const $activeBuffer = atom<string | null>(null);

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

export const bufferManager = {
  open(path: string, content = '', language?: string): string {
    const existing = $buffers.get().find(b => b.path === path);
    if (existing) { $activeBuffer.set(existing.id); return existing.id; }

    const id = crypto.randomUUID();
    const filename = path.split('/').pop() ?? path;
    const buf: Buffer = {
      id, path, filename, content,
      language: language ?? langFromPath(path),
      dirty: false, cursorLine: 0, cursorCol: 0, scrollTop: 0,
    };
    $buffers.set([...$buffers.get(), buf]);
    $activeBuffer.set(id);
    return id;
  },

  update(id: string, content: string) {
    $buffers.set($buffers.get().map(b =>
      b.id === id ? { ...b, content, dirty: true } : b
    ));
    // Sprint 14 — schedule RAG re-index on every file update (debounced 2s)
    const buf = $buffers.get().find(b => b.id === id);
    if (buf?.path) {
      import('../ai/EmbeddingEngine')
        .then(m => m.embeddingEngine.scheduleIndex(buf.path, content))
        .catch(() => { /* engine not ready */ });
    }
  },

  markSaved(id: string) {
    $buffers.set($buffers.get().map(b =>
      b.id === id ? { ...b, dirty: false } : b
    ));
    import('../accessibility/AudioCueService')
      .then(m => m.audioCueService.cue('file-saved'))
      .catch(() => {});
  },

  close(id: string) {
    const list = $buffers.get().filter(b => b.id !== id);
    $buffers.set(list);
    if ($activeBuffer.get() === id) {
      $activeBuffer.set(list[list.length - 1]?.id ?? null);
    }
  },

  swipeNext() {
    const list = $buffers.get();
    if (list.length < 2) return;
    const idx = list.findIndex(b => b.id === $activeBuffer.get());
    $activeBuffer.set(list[(idx + 1) % list.length].id);
  },

  swipePrev() {
    const list = $buffers.get();
    if (list.length < 2) return;
    const idx = list.findIndex(b => b.id === $activeBuffer.get());
    $activeBuffer.set(list[(idx - 1 + list.length) % list.length].id);
  },

  saveCursor(id: string, line: number, col: number, scrollTop: number) {
    $buffers.set($buffers.get().map(b =>
      b.id === id ? { ...b, cursorLine: line, cursorCol: col, scrollTop } : b
    ));
  },

  getActive(): Buffer | undefined {
    return $buffers.get().find(b => b.id === $activeBuffer.get());
  },
};
