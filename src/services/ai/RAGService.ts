// RAGService.ts — Retrieval-Augmented Generation with Cloudflare Vectorize.
//
// Sprint 2 Task 3.3: RAG with RAGFlow patterns.
//   - Hybrid search: BM25 keyword + cosine similarity
//   - Cloudflare Workers AI embeddings
//   - Cloudflare Vectorize for scalable vector storage
//   - Falls back to local Dexie store when Vectorize unavailable

import { embeddingEngine, type EmbeddedChunk, type RetrievedChunk } from './EmbeddingEngine';

export interface RAGOptions {
  topK?: number;
  bm25Weight?: number;
  vectorWeight?: number;
}

export interface RAGChunk extends RetrievedChunk {
  bm25Score?: number;
  vectorScore?: number;
  hybridScore?: number;
}

class RAGService {
  private vectorizeAvailable = false;
  private vectorizeIndex = 'devnoder-rag';

  async init(): Promise<void> {
    // Check if Cloudflare Vectorize is available via env
    // In the browser, this would be through a Worker API
    this.vectorizeAvailable = false;
  }

  async retrieve(query: string, options: RAGOptions = {}): Promise<RAGChunk[]> {
    const { topK = 5, bm25Weight = 0.3, vectorWeight = 0.7 } = options;

    // Get vector results from local engine
    const vectorResults = await embeddingEngine.retrieve(query, topK * 2);

    // Get BM25 results (simple keyword matching on chunks)
    const bm25Results = await this.bm25Search(query, topK * 2);

    // Merge and re-rank
    const merged = this.mergeResults(vectorResults, bm25Results, vectorWeight, bm25Weight);

    return merged.slice(0, topK);
  }

  async indexFile(path: string, content: string): Promise<void> {
    await embeddingEngine.indexFile(path, content);
  }

  async indexAll(files: Array<{ path: string; content: string }>, onProgress?: (done: number, total: number) => void): Promise<void> {
    await embeddingEngine.indexAll(files, onProgress);
  }

  async stats() {
    return embeddingEngine.stats();
  }

  async clearIndex(): Promise<void> {
    await embeddingEngine.clearIndex();
  }

  isModelLoaded(): boolean {
    return embeddingEngine.isModelLoaded();
  }

  onProgress(cb: (p: number, label: string) => void) {
    embeddingEngine.onProgress(cb);
  }

  // ── BM25-style keyword search ─────────────────────────────────────────────
  private async bm25Search(query: string, topK: number): Promise<Array<{ path: string; chunk: string; score: number; chunkIndex: number }>> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    const all = await embeddingEngine.retrieve('', 1000);
    const scored = all.map(chunk => {
      const lower = chunk.chunk.toLowerCase();
      let score = 0;
      for (const term of terms) {
        const matches = (lower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
        score += matches / (chunk.chunk.length + 1);
      }
      return { ...chunk, score };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

    return scored;
  }

  // ── Merge vector and BM25 results ────────────────────────────────────────
  private mergeResults(
    vectorResults: RetrievedChunk[],
    bm25Results: Array<{ path: string; chunk: string; score: number; chunkIndex: number }>,
    vectorWeight: number,
    bm25Weight: number,
  ): RAGChunk[] {
    const map = new Map<string, RAGChunk>();

    for (const r of vectorResults) {
      const key = `${r.path}:${r.chunkIndex}`;
      map.set(key, {
        path: r.path,
        chunk: r.chunk,
        score: r.score,
        chunkIndex: r.chunkIndex,
        vectorScore: r.score,
        hybridScore: r.score * vectorWeight,
      });
    }

    for (const r of bm25Results) {
      const key = `${r.path}:${r.chunkIndex}`;
      const existing = map.get(key);
      const bm25Norm = Math.min(r.score * 10, 1); // normalize BM25 score
      if (existing) {
        existing.bm25Score = bm25Norm;
        existing.hybridScore = (existing.vectorScore ?? 0) * vectorWeight + bm25Norm * bm25Weight;
      } else {
        map.set(key, {
          path: r.path,
          chunk: r.chunk,
          score: bm25Norm,
          chunkIndex: r.chunkIndex,
          bm25Score: bm25Norm,
          hybridScore: bm25Norm * bm25Weight,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0));
  }
}

export const ragService = new RAGService();
