// ComputePool.ts — community compute sharing via Cloudflare Workers
const POOL_WORKER = 'https://devnoder-executor.srvel-build.workers.dev/pool';

export interface PoolTask {
  id: string;
  type: 'build' | 'test' | 'lint' | 'ai-finetune';
  payload: string;
  priority: 'low' | 'normal' | 'high';
  createdAt: number;
  status: 'queued' | 'running' | 'done' | 'failed';
  result?: string;
  durationMs?: number;
}

export interface PoolStats {
  activeWorkers: number;
  queuedTasks: number;
  completedToday: number;
  yourContribution: number;  // CPU-seconds donated
}

class ComputePool {
  private contributing = false;
  private worker: Worker | null = null;
  private tasks: PoolTask[] = [];

  async getStats(): Promise<PoolStats> {
    try {
      const res = await fetch(`${POOL_WORKER}/stats`, { signal: AbortSignal.timeout(4000) });
      return res.ok ? res.json() : this.offlineStats();
    } catch { return this.offlineStats(); }
  }

  private offlineStats(): PoolStats {
    return { activeWorkers: 0, queuedTasks: 0, completedToday: 0, yourContribution: 0 };
  }

  async submit(type: PoolTask['type'], payload: string, priority: PoolTask['priority'] = 'normal'): Promise<PoolTask> {
    const task: PoolTask = {
      id: crypto.randomUUID(), type, payload, priority,
      createdAt: Date.now(), status: 'queued',
    };
    this.tasks.push(task);
    try {
      const res = await fetch(`${POOL_WORKER}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      if (res.ok) { const data = await res.json(); Object.assign(task, data); }
    } catch { task.status = 'failed'; task.result = 'Pool unavailable — deploy executor Worker'; }
    return task;
  }

  async pollTask(id: string): Promise<PoolTask | null> {
    const local = this.tasks.find(t => t.id === id);
    if (!local) return null;
    try {
      const res = await fetch(`${POOL_WORKER}/task/${id}`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) { const data = await res.json(); Object.assign(local, data); }
    } catch {}
    return local;
  }

  startContributing(): void {
    if (this.contributing) return;
    this.contributing = true;
    // In prod: spawn a Web Worker that polls for tasks and executes them via WASM
    console.log('ComputePool: contributing idle cycles');
  }

  stopContributing(): void {
    this.contributing = false;
    this.worker?.terminate();
    this.worker = null;
  }

  isContributing() { return this.contributing; }

  async exportFineTuneDataset(): Promise<string> {
    // Export conversation history as JSONL for fine-tuning
    const history = JSON.parse(localStorage.getItem('devnoder-ai-history') ?? '[]');
    return history
      .filter((h: any) => h.rating >= 4)
      .map((h: any) => JSON.stringify({ messages: h.messages, rating: h.rating }))
      .join('\n');
  }
}

export const computePool = new ComputePool();
