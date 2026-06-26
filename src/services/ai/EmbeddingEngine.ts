// EmbeddingEngine.ts — Transformers.js local embeddings + Dexie vector store
// Model: Xenova/all-MiniLM-L6-v2 (~23MB, 384-dim, works offline on A72)
import Dexie, { Table } from 'dexie';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EmbeddedChunk {
  id?: number;
  path: string;
  chunkIndex: number;
  chunk: string;       // raw text of this chunk
  vector: number[];    // 384-float embedding
  updatedAt: number;
}

export interface RetrievedChunk {
  path: string;
  chunk: string;
  score: number;       // cosine similarity 0–1
  chunkIndex: number;
}

// ─── Dexie store ──────────────────────────────────────────────────────────────
class EmbeddingDB extends Dexie {
  chunks!: Table<EmbeddedChunk>;
  constructor() {
    super('devnoder-embeddings');
    this.version(1).stores({ chunks: '++id, path, chunkIndex, updatedAt' });
  }
}

const db = new EmbeddingDB();

// ─── Chunking ─────────────────────────────────────────────────────────────────
const CHUNK_SIZE    = 512;   // tokens (approx chars/4)
const CHUNK_OVERLAP = 64;

function chunkText(text: string, path: string): string[] {
  // Skip binary files, very large files, node_modules, .git
  if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|bin|zip)$/i.test(path)) return [];
  if (text.length > 500_000) return [];

  const words  = text.split(/\s+/);
  const chunks: string[] = [];
  const step   = CHUNK_SIZE - CHUNK_OVERLAP;

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
    if (chunk.trim().length > 20) chunks.push(chunk); // skip near-empty chunks
  }
  return chunks;
}

// ─── Cosine similarity ────────────────────────────────────────────────────────
function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Main service ─────────────────────────────────────────────────────────────
class EmbeddingEngine {
  private pipeline: any = null;
  private loading = false;
  private onProgressCbs: Array<(p: number, label: string) => void> = [];
  private indexQueue: Array<{ path: string; content: string }> = [];
  private indexTimer: ReturnType<typeof setTimeout> | null = null;

  onProgress(cb: (p: number, label: string) => void) { this.onProgressCbs.push(cb); }
  private emitProgress(p: number, label: string) { this.onProgressCbs.forEach(cb => cb(p, label)); }

  async loadModel(): Promise<void> {
    if (this.pipeline || this.loading) return;
    this.loading = true;
    try {
      this.emitProgress(5, 'Loading embedding model…');
      const { pipeline, env } = await import('@xenova/transformers');
      // Allow loading from CDN (cached in browser after first load)
      env.allowRemoteModels = true;
      this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        progress_callback: (info: any) => {
          if (info.status === 'progress') {
            this.emitProgress(
              5 + Math.round(info.progress * 0.9),
              `Embedding model: ${info.file ?? ''}…`
            );
          }
        },
      });
      this.emitProgress(100, 'Embedding model ready');
    } finally {
      this.loading = false;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    await this.loadModel();
    const output = await this.pipeline(texts, { pooling: 'mean', normalize: true });
    // output.tolist() returns number[][]
    return output.tolist ? output.tolist() : Array.from(output.data).reduce((acc: number[][], _: unknown, i: number) => {
      if (i % 384 === 0) acc.push(Array.from(output.data.slice(i, i + 384)));
      return acc;
    }, []);
  }

  // ── Indexing ────────────────────────────────────────────────────────────────
  async indexFile(path: string, content: string): Promise<void> {
    if (!path || !content) return;
    const chunks = chunkText(content, path);
    if (!chunks.length) return;

    // Delete old chunks for this file
    await db.chunks.where('path').equals(path).delete();

    let vectors: number[][];
    try {
      vectors = await this.embed(chunks);
    } catch {
      return; // model not loaded yet — skip silently
    }

    const now = Date.now();
    await db.chunks.bulkAdd(
      chunks.map((chunk, chunkIndex) => ({
        path,
        chunkIndex,
        chunk,
        vector: vectors[chunkIndex] ?? [],
        updatedAt: now,
      }))
    );
  }

  /** Debounced index — called on every file save */
  scheduleIndex(path: string, content: string): void {
    this.indexQueue.push({ path, content });
    if (this.indexTimer) clearTimeout(this.indexTimer);
    this.indexTimer = setTimeout(() => {
      const batch = [...this.indexQueue];
      this.indexQueue = [];
      Promise.all(batch.map(({ path, content }) => this.indexFile(path, content)))
        .catch(console.warn);
    }, 2000);
  }

  /** Index all files in the project — called on first run or rebuild */
  async indexAll(
    files: Array<{ path: string; content: string }>,
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    await this.loadModel();
    const skippable = new Set<string>();

    // Check which files haven't changed
    const existing = await db.chunks.orderBy('updatedAt').toArray();
    const existingPaths = new Set(existing.map(c => c.path));

    for (let i = 0; i < files.length; i++) {
      const { path, content } = files[i];
      onProgress?.(i + 1, files.length);
      if (existingPaths.has(path)) continue; // skip already indexed
      await this.indexFile(path, content);
    }
  }

  // ── Retrieval ────────────────────────────────────────────────────────────────
  async retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
    if (!query.trim()) return [];

    let queryVec: number[];
    try {
      const vecs = await this.embed([query]);
      queryVec = vecs[0];
    } catch {
      return []; // model not ready
    }

    const all = await db.chunks.toArray();
    if (!all.length) return [];

    const scored = all
      .filter(c => c.vector.length === queryVec.length)
      .map(c => ({ ...c, score: cosine(queryVec, c.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(c => ({
      path: c.path,
      chunk: c.chunk,
      score: c.score,
      chunkIndex: c.chunkIndex,
    }));
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  async stats(): Promise<{
    files: number; chunks: number; sizeKB: number; lastIndexed: number | null;
    fileList: Array<{ path: string; chunks: number; updatedAt: number }>;
  }> {
    const all = await db.chunks.toArray();

    // Build per-file breakdown
    const byFile = new Map<string, { chunks: number; updatedAt: number }>();
    for (const c of all) {
      const existing = byFile.get(c.path);
      if (!existing) {
        byFile.set(c.path, { chunks: 1, updatedAt: c.updatedAt });
      } else {
        existing.chunks++;
        if (c.updatedAt > existing.updatedAt) existing.updatedAt = c.updatedAt;
      }
    }

    const fileList = Array.from(byFile.entries())
      .map(([path, meta]) => ({ path, ...meta }))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const files    = fileList.length;
    const chunks   = all.length;
    const sizeKB   = Math.round(all.reduce((s, c) => s + c.vector.length * 4, 0) / 1024);
    const lastIndexed = all.length ? Math.max(...all.map(c => c.updatedAt)) : null;

    return { files, chunks, sizeKB, lastIndexed, fileList };
  }

  async clearIndex(): Promise<void> {
    await db.chunks.clear();
  }

  isModelLoaded(): boolean { return !!this.pipeline; }
}

export const embeddingEngine = new EmbeddingEngine();
